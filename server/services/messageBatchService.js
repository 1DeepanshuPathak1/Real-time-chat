const { connectRedis } = require('../config/redisConfig');
const EnhancedCacheService = require('./enhancedCacheService');

class MessageBatchService extends EnhancedCacheService {
    constructor(db) {
        super(db);
        this.maxBatchSize = 50;
        this.startBatchProcessor();
    }

    async addMessageToBatch(roomId, messageData) {
        const redis = await connectRedis();
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        let processedContent = messageData.content;
        let finalSize = messageData.fileSize || messageData.originalSize;

        if (messageData.type === 'document') {
            if (finalSize && finalSize > 3 * 1024 * 1024) {
                throw new Error('Document files must be smaller than 3MB');
            }
            processedContent = messageData.content;
        }

        const messageWithId = {
            i: messageId,
            s: messageData.sender,
            c: processedContent,
            t: Date.now(),
            ty: messageData.type || 'text',
            ...(messageData.fileName && { fn: messageData.fileName }),
            ...(finalSize && { fs: finalSize }),
            ...(messageData.fileType && { ft: messageData.fileType }),
            ...(messageData.originalSize && { os: messageData.originalSize }),
            ...(messageData.replyTo && { r: messageData.replyTo })
        };

        const key = `pending_messages:${roomId}`;
        await redis.lPush(key, JSON.stringify(messageWithId));
        await redis.expire(key, 300);

        const currentChunkId = await this.getCurrentChunkId(roomId);
        await this.markChunkDirty(roomId, currentChunkId);

        return messageId;
    }

    async getLatestMessages(roomId) {
        try {
            const chunks = await this.getChunksFromCache(roomId, 2);
            
            if (chunks.length === 0) {
                return { messages: [], chunkId: 'chunk_1', hasMore: false };
            }

            const latestChunk = chunks[chunks.length - 1];
            const allMessages = chunks.flatMap(chunk => chunk.messages);

            return {
                messages: allMessages,
                chunkId: latestChunk.id,
                hasMore: chunks.length > 1 || chunks[0].hasMore
            };
        } catch (error) {
            console.error('Error fetching latest messages:', error);
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async getLatestChunk(roomId) {
        const chunks = await this.getChunksFromCache(roomId, 1);
        return chunks[0] || { id: 'chunk_1', messages: [], hasMore: false };
    }

    async getOlderMessages(roomId, currentChunkId) {
        try {
            const currentChunkNumber = parseInt(currentChunkId.split('_')[1]);
            const olderChunkNumber = currentChunkNumber - 1;

            if (olderChunkNumber < 1) {
                return { messages: [], chunkId: null, hasMore: false };
            }

            const olderChunkId = `chunk_${olderChunkNumber}`;
            const chunks = await this.getChunksFromCache(roomId, 1);
            
            const olderChunk = chunks.find(chunk => chunk.id === olderChunkId) || 
                             await this.loadChunkFromDB(roomId, olderChunkId);

            if (!olderChunk) {
                return { messages: [], chunkId: null, hasMore: false };
            }

            return {
                messages: olderChunk.messages,
                chunkId: olderChunk.id,
                hasMore: await this.hasOlderChunks(roomId, olderChunk.id)
            };
        } catch (error) {
            console.error('Error fetching older messages:', error);
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async addReactionToMessage(roomId, messageId, emoji, userName, remove = false) {
        try {
            const chunks = await this.getChunksFromCache(roomId, 5);
            
            for (const chunk of chunks) {
                const messageIndex = chunk.messages.findIndex(msg => msg.id === messageId);
                
                if (messageIndex !== -1) {
                    const message = chunk.messages[messageIndex];
                    let reactions = message.em || {};

                    if (remove) {
                        if (reactions[emoji]) {
                            reactions[emoji] = reactions[emoji].filter(user => user !== userName);
                            if (reactions[emoji].length === 0) {
                                delete reactions[emoji];
                            }
                        }
                    } else {
                        for (const [existingEmoji, users] of Object.entries(reactions)) {
                            const userIndex = users.indexOf(userName);
                            if (userIndex > -1) {
                                users.splice(userIndex, 1);
                                if (users.length === 0) {
                                    delete reactions[existingEmoji];
                                }
                            }
                        }

                        if (!reactions[emoji]) {
                            reactions[emoji] = [];
                        }
                        if (!reactions[emoji].includes(userName)) {
                            reactions[emoji].push(userName);
                        }

                        if (Object.keys(reactions).length > 2) {
                            const reactionKeys = Object.keys(reactions);
                            const oldestReaction = reactionKeys[0];
                            delete reactions[oldestReaction];
                        }
                    }

                    if (Object.keys(reactions).length === 0) {
                        delete chunk.messages[messageIndex].em;
                    } else {
                        chunk.messages[messageIndex].em = reactions;
                    }

                    await this.markChunkDirty(roomId, chunk.id);
                    await this.cacheChunk(roomId, chunk.id, chunk);

                    return reactions;
                }
            }

            const chunkRef = await this.findMessageChunk(roomId, messageId);
            if (chunkRef) {
                const chunkDoc = await chunkRef.get();
                if (chunkDoc.exists) {
                    const chunkData = chunkDoc.data();
                    const messages = chunkData.messages || [];
                    
                    const messageIndex = messages.findIndex(msg => (msg.i || msg.id) === messageId);
                    if (messageIndex !== -1) {
                        const message = messages[messageIndex];
                        let reactions = message.em || {};

                        if (remove) {
                            if (reactions[emoji]) {
                                reactions[emoji] = reactions[emoji].filter(user => user !== userName);
                                if (reactions[emoji].length === 0) {
                                    delete reactions[emoji];
                                }
                            }
                        } else {
                            for (const [existingEmoji, users] of Object.entries(reactions)) {
                                const userIndex = users.indexOf(userName);
                                if (userIndex > -1) {
                                    users.splice(userIndex, 1);
                                    if (users.length === 0) {
                                        delete reactions[existingEmoji];
                                    }
                                }
                            }

                            if (!reactions[emoji]) {
                                reactions[emoji] = [];
                            }
                            if (!reactions[emoji].includes(userName)) {
                                reactions[emoji].push(userName);
                            }
                        }

                        if (Object.keys(reactions).length === 0) {
                            delete messages[messageIndex].em;
                        } else {
                            messages[messageIndex].em = reactions;
                        }

                        await chunkRef.update({
                            messages: messages,
                            updatedAt: new Date().toISOString()
                        });

                        return reactions;
                    }
                }
            }

            throw new Error(`Message ${messageId} not found`);
        } catch (error) {
            console.error('Error updating reaction:', error);
            throw error;
        }
    }

    async findMessageChunk(roomId, messageId) {
        try {
            const chunksRef = this.db.collection('rooms').doc(roomId).collection('messageChunks');
            const chunksSnapshot = await chunksRef.get();
            
            for (const chunkDoc of chunksSnapshot.docs) {
                const chunkData = chunkDoc.data();
                const messages = chunkData.messages || [];
                
                const messageExists = messages.some(msg => (msg.i || msg.id) === messageId);
                if (messageExists) {
                    return chunkDoc.ref;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding message chunk:', error);
            throw error;
        }
    }

    async incrementChunkIfNeeded(roomId, currentChunkId) {
        const redis = await connectRedis();
        const chunkSize = await redis.get(`chunk_size:${roomId}:${currentChunkId}`) || 0;

        if (parseInt(chunkSize) >= this.maxBatchSize) {
            const chunkNumber = parseInt(currentChunkId.split('_')[1]) + 1;
            const newChunkId = `chunk_${chunkNumber}`;
            await redis.set(`current_chunk:${roomId}`, newChunkId);
            await redis.set(`chunk_size:${roomId}:${newChunkId}`, 0);
            return newChunkId;
        }

        return currentChunkId;
    }

    startBatchProcessor() {
        setInterval(async () => {
            await this.processBatchWrites();
        }, 5000);
    }

    async processBatchWrites() {
        const redis = await connectRedis();
        const keys = await redis.keys('pending_messages:*');

        for (const key of keys) {
            const roomId = key.split(':')[1];
            await this.processBatchForRoom(roomId);
        }
    }

    async processBatchForRoom(roomId) {
        const redis = await connectRedis();
        const key = `pending_messages:${roomId}`;
        const pendingMessages = [];
        let message;

        while ((message = await redis.rPop(key))) {
            pendingMessages.push(JSON.parse(message));
            if (pendingMessages.length >= this.maxBatchSize) break;
        }

        if (pendingMessages.length === 0) return;

        const currentChunkId = await this.getLatestChunkId(roomId);
        const cacheKey = `chunk:${roomId}:${currentChunkId}`;
        const cached = await redis.get(cacheKey);
        
        let existingMessages = [];
        if (cached) {
            const cachedData = JSON.parse(cached);
            existingMessages = cachedData.messages || [];
        }

        const formattedPendingMessages = this.formatMessages(pendingMessages);
        const allMessages = [...existingMessages, ...formattedPendingMessages];

        if (allMessages.length > this.maxBatchSize) {
            const newChunkNumber = parseInt(currentChunkId.split('_')[1]) + 1;
            const newChunkId = `chunk_${newChunkNumber}`;
            
            const splitPoint = this.maxBatchSize - existingMessages.length;
            const currentChunkMessages = [...existingMessages, ...formattedPendingMessages.slice(0, splitPoint)];
            const newChunkMessages = formattedPendingMessages.slice(splitPoint);

            const currentChunkData = {
                id: currentChunkId,
                messages: currentChunkMessages,
                hasMore: parseInt(currentChunkId.split('_')[1]) > 1,
                isDirty: true
            };

            await this.cacheChunk(roomId, currentChunkId, currentChunkData);
            await this.markChunkDirty(roomId, currentChunkId);

            const newChunkData = {
                id: newChunkId,
                messages: newChunkMessages,
                hasMore: true,
                isDirty: true
            };

            await this.cacheChunk(roomId, newChunkId, newChunkData);
            await this.markChunkDirty(roomId, newChunkId);
            await redis.setEx(`latest_chunk:${roomId}`, 300, newChunkId);
        } else {
            const chunkData = {
                id: currentChunkId,
                messages: allMessages,
                hasMore: parseInt(currentChunkId.split('_')[1]) > 1,
                isDirty: true
            };

            await this.cacheChunk(roomId, currentChunkId, chunkData);
            await this.markChunkDirty(roomId, currentChunkId);
        }
    }

    async updateRoomMetadata(roomId, lastMessage) {
        const roomRef = this.db.collection('rooms').doc(roomId);
        const metadata = {
            lastMessage: {
                content: lastMessage.c,
                sender: lastMessage.s,
                time: new Date(lastMessage.t).toISOString(),
                type: lastMessage.ty
            },
            lastMessageTime: new Date(lastMessage.t).toISOString(),
            lastMessageTimestamp: lastMessage.t,
            lastMessageId: lastMessage.i,
            updatedAt: new Date().toISOString()
        };

        await roomRef.set(metadata, { merge: true });
        await this.cacheRoomMetadata(roomId, metadata);
    }

    async markMessagesAsRead(roomId, userId, lastReadMessageId) {
        const roomRef = this.db.collection('rooms').doc(roomId);
        const readData = {
            [`lastReadMessageId_${userId}`]: lastReadMessageId,
            [`lastReadTimestamp_${userId}`]: Date.now()
        };

        await roomRef.update(readData);
        
        const cachedMetadata = await this.getCachedRoomMetadata(roomId);
        if (cachedMetadata) {
            Object.assign(cachedMetadata, readData);
            await this.cacheRoomMetadata(roomId, cachedMetadata);
        }
    }

    async getMessagesFromRedis(roomId) {
        return await this.getPendingMessages(roomId);
    }

    async getCurrentChunkId(roomId) {
        return await this.getLatestChunkId(roomId);
    }

    async hasOlderChunks(roomId, chunkId) {
        const chunkNumber = parseInt(chunkId.split('_')[1]);
        return chunkNumber > 1;
    }

    async getCachedUnreadCount(roomId, userId) {
        const redis = await connectRedis();
        const cached = await redis.get(`unread:${roomId}:${userId}`);
        return cached ? parseInt(cached) : null;
    }

    async cacheUnreadCount(roomId, userId, count) {
        const redis = await connectRedis();
        await redis.setEx(`unread:${roomId}:${userId}`, 300, count.toString());
    }

    async getCachedRoomMetadata(roomId) {
        const redis = await connectRedis();
        const cached = await redis.get(`room_meta:${roomId}`);
        return cached ? JSON.parse(cached) : null;
    }

    async cacheRoomMetadata(roomId, metadata) {
        const redis = await connectRedis();
        await redis.setEx(`room_meta:${roomId}`, 600, JSON.stringify(metadata));
    }

    async getCachedContactList(userId) {
        const redis = await connectRedis();
        const cached = await redis.get(`contacts:${userId}`);
        return cached ? JSON.parse(cached) : null;
    }

    async cacheContactList(userId, contacts) {
        const redis = await connectRedis();
        await redis.setEx(`contacts:${userId}`, 300, JSON.stringify(contacts));
    }

    async getCachedUserStatus(userId) {
        const redis = await connectRedis();
        const cached = await redis.get(`user_status:${userId}`);
        return cached ? JSON.parse(cached) : null;
    }

    async cacheUserStatus(userId, status) {
        const redis = await connectRedis();
        await redis.setEx(`user_status:${userId}`, 120, JSON.stringify(status));
    }
}

module.exports = MessageBatchService;