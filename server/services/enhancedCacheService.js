const { connectRedis } = require('../config/redisConfig');

class EnhancedCacheService {
    constructor(db) {
        this.db = db;
        this.chunkTTL = 1800;
        this.dirtyChunks = new Set();
        this.startCacheManager();
    }

    compressLZW(data) {
        const dict = {};
        let dictSize = 256;
        const result = [];
        let w = '';
        
        for (let i = 0; i < 256; i++) {
            dict[String.fromCharCode(i)] = i;
        }
        
        for (let i = 0; i < data.length; i++) {
            const c = data[i];
            const wc = w + c;
            
            if (dict.hasOwnProperty(wc)) {
                w = wc;
            } else {
                result.push(dict[w]);
                dict[wc] = dictSize++;
                w = c;
            }
        }
        
        if (w !== '') {
            result.push(dict[w]);
        }
        
        const compressed = result.map(code => String.fromCharCode(code)).join('');
        return Buffer.from(compressed).toString('base64');
    }

    decompressLZW(compressed) {
        try {
            const data = Buffer.from(compressed, 'base64').toString('binary');
            const codes = Array.from(data).map(c => c.charCodeAt(0));
            const dict = {};
            let dictSize = 256;
            let result = '';
            let w = String.fromCharCode(codes[0]);
            result += w;
            
            for (let i = 0; i < 256; i++) {
                dict[i] = String.fromCharCode(i);
            }
            
            for (let i = 1; i < codes.length; i++) {
                const k = codes[i];
                let entry;
                
                if (dict[k]) {
                    entry = dict[k];
                } else if (k === dictSize) {
                    entry = w + w[0];
                } else {
                    throw new Error('Invalid compression');
                }
                
                result += entry;
                dict[dictSize++] = w + entry[0];
                w = entry;
            }
            
            return Buffer.from(result, 'binary').toString('base64');
        } catch (error) {
            console.error('Decompression failed:', error);
            return compressed;
        }
    }

    async getChunksFromCache(roomId, count = 2) {
        const redis = await connectRedis();
        const latestChunkId = await this.getLatestChunkId(roomId);
        const chunks = [];
        let chunkNumber = parseInt(latestChunkId.split('_')[1]);
        
        for (let i = 0; i < count && chunkNumber > 0; i++) {
            const chunkId = `chunk_${chunkNumber}`;
            const cacheKey = `chunk:${roomId}:${chunkId}`;
            
            let chunkData = await redis.get(cacheKey);
            
            if (chunkData) {
                chunks.unshift(JSON.parse(chunkData));
            } else {
                const dbChunk = await this.loadChunkFromDB(roomId, chunkId);
                if (dbChunk) {
                    await this.cacheChunk(roomId, chunkId, dbChunk);
                    chunks.unshift(dbChunk);
                } else {
                    break;
                }
            }
            chunkNumber--;
        }
        
        const pendingMessages = await this.getPendingMessages(roomId);
        if (chunks.length > 0 && pendingMessages.length > 0) {
            chunks[chunks.length - 1].messages = [...chunks[chunks.length - 1].messages, ...pendingMessages];
        }
        
        return chunks;
    }

    async cacheChunk(roomId, chunkId, chunkData) {
        const redis = await connectRedis();
        const cacheKey = `chunk:${roomId}:${chunkId}`;
        
        const compressedMessages = chunkData.messages.map(msg => {
            if (msg.type === 'document' && msg.content && !msg.content.startsWith('data:')) {
                return {
                    ...msg,
                    content: this.compressLZW(msg.content)
                };
            }
            return msg;
        });
        
        await redis.setEx(cacheKey, this.chunkTTL, JSON.stringify({
            ...chunkData,
            messages: compressedMessages,
            isDirty: false
        }));
    }

    async markChunkDirty(roomId, chunkId) {
        const redis = await connectRedis();
        const cacheKey = `chunk:${roomId}:${chunkId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            const chunkData = JSON.parse(cached);
            chunkData.isDirty = true;
            await redis.setEx(cacheKey, this.chunkTTL, JSON.stringify(chunkData));
            this.dirtyChunks.add(cacheKey);
        }
    }

    async flushDirtyChunk(cacheKey) {
        const redis = await connectRedis();
        const cached = await redis.get(cacheKey);
        if (cached) {
            const chunkData = JSON.parse(cached);
            if (chunkData.isDirty) {
                const [, roomId, chunkId] = cacheKey.split(':');
                await this.writeChunkToDB(roomId, chunkId, chunkData);
                chunkData.isDirty = false;
                await redis.setEx(cacheKey, this.chunkTTL, JSON.stringify(chunkData));
                this.dirtyChunks.delete(cacheKey);
            }
        }
    }

    async loadChunkFromDB(roomId, chunkId) {
        const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(chunkId);
        const chunkDoc = await chunkRef.get();
        
        if (chunkDoc.exists) {
            const chunkData = chunkDoc.data();
            const decompressedMessages = this.formatMessages(chunkData.messages || []);
            
            return {
                id: chunkId,
                messages: decompressedMessages,
                hasMore: parseInt(chunkId.split('_')[1]) > 1
            };
        }
        return null;
    }

    async writeChunkToDB(roomId, chunkId, chunkData) {
        const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(chunkId);
        
        const compressedMessages = chunkData.messages.map(msg => this.compressMessage(msg));
        
        await chunkRef.set({
            messages: compressedMessages,
            updatedAt: new Date().toISOString(),
            messageCount: chunkData.messages.length
        }, { merge: true });
    }

    async getLatestChunkId(roomId) {
        const redis = await connectRedis();
        
        let latestChunkId = await redis.get(`latest_chunk:${roomId}`);
        if (latestChunkId) {
            return latestChunkId;
        }
        
        const chunksRef = this.db.collection('rooms').doc(roomId).collection('messageChunks');
        const snapshot = await chunksRef.orderBy('createdAt', 'desc').limit(1).get();
        
        if (!snapshot.empty) {
            latestChunkId = snapshot.docs[0].id;
            await redis.setEx(`latest_chunk:${roomId}`, 300, latestChunkId);
            return latestChunkId;
        }
        
        latestChunkId = 'chunk_1';
        await redis.setEx(`latest_chunk:${roomId}`, 300, latestChunkId);
        return latestChunkId;
    }

    async getPendingMessages(roomId) {
        const redis = await connectRedis();
        const key = `pending_messages:${roomId}`;
        const messages = await redis.lRange(key, 0, -1);
        return this.formatMessages(messages.map(msg => JSON.parse(msg))).reverse();
    }

    startCacheManager() {
        setInterval(async () => {
            const redis = await connectRedis();
            for (const cacheKey of this.dirtyChunks) {
                const ttl = await redis.ttl(cacheKey);
                if (ttl < 60) {
                    await this.flushDirtyChunk(cacheKey);
                }
            }
        }, 30000);
    }

    compressMessage(msg) {
        let content = msg.content || msg.c;
        
        if (msg.type === 'document' && content && !content.startsWith('data:')) {
            content = this.compressLZW(content);
        }
        
        return {
            i: msg.id || msg.i,
            s: msg.sender || msg.s,
            c: content,
            t: msg.timestamp || msg.t,
            ty: msg.type || msg.ty || 'text',
            ...(msg.fileName && { fn: msg.fileName }),
            ...(msg.fileSize && { fs: msg.fileSize }),
            ...(msg.fileType && { ft: msg.fileType }),
            ...(msg.originalSize && { os: msg.originalSize }),
            ...(msg.compressedSize && { cs: msg.compressedSize }),
            ...(msg.replyTo && { r: msg.replyTo }),
            ...(msg.em && { em: msg.em })
        };
    }

    formatMessages(messages) {
        return messages.map(msg => {
            let content = msg.c || msg.content;
            
            if (msg.ty === 'document' && content && !content.startsWith('data:')) {
                try {
                    content = this.decompressLZW(content);
                } catch (error) {
                    console.error('Error decompressing message content:', error);
                }
            }
            
            return {
                id: msg.i || msg.id,
                sender: msg.s || msg.sender,
                content: content,
                time: new Date(msg.t || msg.timestamp || msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: msg.t || msg.timestamp || msg.time,
                type: msg.ty || msg.type || 'text',
                fileName: msg.fn || msg.fileName,
                fileSize: msg.fs || msg.fileSize,
                fileType: msg.ft || msg.fileType,
                originalSize: msg.os || msg.originalSize,
                compressedSize: msg.cs || msg.compressedSize,
                replyTo: msg.r || msg.replyTo,
                em: msg.em
            };
        });
    }
}

module.exports = EnhancedCacheService;