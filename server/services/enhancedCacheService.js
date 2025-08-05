const { connectRedis } = require('../config/redisConfig');

class EnhancedCacheService {
    constructor(db) {
        this.db = db;
        this.chunkTTL = 1800;
        this.dirtyChunks = new Set();
        this.startCacheManager();
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
        await redis.setEx(cacheKey, this.chunkTTL, JSON.stringify({
            ...chunkData,
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
            return {
                id: chunkId,
                messages: this.formatMessages(chunkDoc.data().messages || []),
                hasMore: parseInt(chunkId.split('_')[1]) > 1
            };
        }
        return null;
    }

    async writeChunkToDB(roomId, chunkId, chunkData) {
        const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(chunkId);
        await chunkRef.set({
            messages: chunkData.messages.map(this.compressMessage),
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
        return {
            i: msg.id,
            s: msg.sender,
            c: msg.content,
            t: msg.timestamp,
            ty: msg.type || 'text',
            ...(msg.fileName && { fn: msg.fileName }),
            ...(msg.replyTo && { r: msg.replyTo }),
            ...(msg.em && { em: msg.em })
        };
    }

    formatMessages(messages) {
        return messages.map(msg => ({
            id: msg.i || msg.id,
            sender: msg.s || msg.sender,
            content: msg.c || msg.content,
            time: new Date(msg.t || msg.timestamp || msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: msg.t || msg.timestamp || msg.time,
            type: msg.ty || msg.type || 'text',
            fileName: msg.fn || msg.fileName,
            replyTo: msg.r || msg.replyTo,
            em: msg.em
        }));
    }
}

module.exports = EnhancedCacheService;