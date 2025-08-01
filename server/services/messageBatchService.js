const { connectRedis } = require('../config/redisConfig');

class MessageBatchService {
    constructor(db) {
        this.db = db;
        this.pendingMessages = new Map();
        this.batchWriteInterval = 5000;
        this.maxBatchSize = 50;
        this.startBatchProcessor();
    }

    async addMessageToBatch(roomId, messageData) {
        const redis = await connectRedis();
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const messageWithId = {
            i: messageId,
            s: messageData.sender,
            c: messageData.content,
            t: Date.now(),
            ty: messageData.type || 'text',
            ...(messageData.fileName && { fn: messageData.fileName }),
            ...(messageData.fileSize && { fs: messageData.fileSize }),
            ...(messageData.fileType && { ft: messageData.fileType }),
            ...(messageData.fileUrl && { fu: messageData.fileUrl }),
            ...(messageData.replyTo && { r: messageData.replyTo })
        };

        const key = `pending_messages:${roomId}`;
        await redis.lPush(key, JSON.stringify(messageWithId));
        await redis.expire(key, 300);

        return messageId;
    }

    async addReactionToMessage(roomId, messageId, emoji, userId, userEmail) {
        const redis = await connectRedis();
        
        try {
            const chunkRef = await this.findMessageChunk(roomId, messageId);
            if (!chunkRef) {
                throw new Error(`Message ${messageId} not found in any chunk`);
            }

            const chunkDoc = await chunkRef.get();
            if (!chunkDoc.exists) {
                throw new Error(`Chunk does not exist`);
            }

            const chunkData = chunkDoc.data();
            const messages = chunkData.messages || [];
            
            const messageIndex = messages.findIndex(msg => (msg.i || msg.id) === messageId);
            if (messageIndex === -1) {
                throw new Error(`Message ${messageId} not found in chunk`);
            }

            const message = messages[messageIndex];
            const currentReaction = message.em;
            
            let newReaction = null;
            
            if (currentReaction && currentReaction.emoji === emoji && currentReaction.userId === userId) {
                newReaction = null;
            } else {
                newReaction = {
                    emoji: emoji,
                    userId: userId,
                    userEmail: userEmail,
                    timestamp: Date.now()
                };
            }
            
            if (newReaction) {
                messages[messageIndex].em = newReaction;
            } else {
                delete messages[messageIndex].em;
            }

            await chunkRef.update({
                messages: messages,
                updatedAt: new Date().toISOString()
            });

            return newReaction;
        } catch (error) {
            console.error('Error adding reaction to message:', error);
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

    async getCurrentChunkId(roomId) {
        const redis = await connectRedis();
        const currentChunk = await redis.get(`current_chunk:${roomId}`);
        return currentChunk || 'chunk_1';
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
        }, this.batchWriteInterval);
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

        const currentChunkId = await this.getCurrentChunkId(roomId);
        const newChunkId = await this.incrementChunkIfNeeded(roomId, currentChunkId);

        try {
            const batch = this.db.batch();
            const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(newChunkId);

            const existingChunk = await chunkRef.get();
            const existingMessages = existingChunk.exists ? existingChunk.data().messages || [] : [];

            const allMessages = [...existingMessages, ...pendingMessages];

            if (allMessages.length > this.maxBatchSize) {
                const splitPoint = this.maxBatchSize - existingMessages.length;
                const currentChunkMessages = [...existingMessages, ...pendingMessages.slice(0, splitPoint)];
                const nextChunkMessages = pendingMessages.slice(splitPoint);

                batch.set(chunkRef, {
                    messages: currentChunkMessages,
                    createdAt: existingChunk.exists ? existingChunk.data().createdAt : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    messageCount: currentChunkMessages.length
                });

                if (nextChunkMessages.length > 0) {
                    const nextChunkNumber = parseInt(newChunkId.split('_')[1]) + 1;
                    const nextChunkId = `chunk_${nextChunkNumber}`;
                    const nextChunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(nextChunkId);

                    batch.set(nextChunkRef, {
                        messages: nextChunkMessages,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        messageCount: nextChunkMessages.length
                    });

                    await redis.set(`current_chunk:${roomId}`, nextChunkId);
                    await redis.set(`chunk_size:${roomId}:${nextChunkId}`, nextChunkMessages.length);
                }

                await redis.set(`chunk_size:${roomId}:${newChunkId}`, currentChunkMessages.length);
            } else {
                batch.set(chunkRef, {
                    messages: allMessages,
                    createdAt: existingChunk.exists ? existingChunk.data().createdAt : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    messageCount: allMessages.length
                });

                await redis.set(`chunk_size:${roomId}:${newChunkId}`, allMessages.length);
            }

            await batch.commit();

            await this.updateRoomMetadata(roomId, pendingMessages[pendingMessages.length - 1]);

        } catch (error) {
            console.error('Batch write error:', error);
            for (const msg of pendingMessages) {
                await redis.lPush(key, JSON.stringify(msg));
            }
        }
    }

    async updateRoomMetadata(roomId, lastMessage) {
        const roomRef = this.db.collection('rooms').doc(roomId);
        await roomRef.update({
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
        });
    }

    async markMessagesAsRead(roomId, userId, lastReadMessageId) {
        const roomRef = this.db.collection('rooms').doc(roomId);
        await roomRef.update({
            [`lastReadMessageId_${userId}`]: lastReadMessageId,
            [`lastReadTimestamp_${userId}`]: Date.now()
        });
    }

    async getLatestChunk(roomId) {
        const currentChunkId = await this.getCurrentChunkId(roomId);
        const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(currentChunkId);
        const chunkDoc = await chunkRef.get();

        if (chunkDoc.exists) {
            return {
                id: currentChunkId,
                messages: this.formatMessages(chunkDoc.data().messages || []),
                hasMore: await this.hasOlderChunks(roomId, currentChunkId)
            };
        }

        return { id: currentChunkId, messages: [], hasMore: false };
    }

    async getChunk(roomId, chunkId) {
        const chunkRef = this.db.collection('rooms').doc(roomId).collection('messageChunks').doc(chunkId);
        const chunkDoc = await chunkRef.get();

        if (chunkDoc.exists) {
            return {
                id: chunkId,
                messages: this.formatMessages(chunkDoc.data().messages || []),
                hasMore: await this.hasOlderChunks(roomId, chunkId)
            };
        }

        return null;
    }

    async getOlderChunk(roomId, currentChunkId) {
        const currentChunkNumber = parseInt(currentChunkId.split('_')[1]);
        const olderChunkNumber = currentChunkNumber - 1;

        if (olderChunkNumber < 1) return null;

        const olderChunkId = `chunk_${olderChunkNumber}`;
        return await this.getChunk(roomId, olderChunkId);
    }

    async hasOlderChunks(roomId, chunkId) {
        const chunkNumber = parseInt(chunkId.split('_')[1]);
        return chunkNumber > 1;
    }

    async getMessagesFromRedis(roomId) {
        const redis = await connectRedis();
        const key = `pending_messages:${roomId}`;
        const messages = await redis.lRange(key, 0, -1);
        return this.formatMessages(messages.map(msg => JSON.parse(msg))).reverse();
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
            fileSize: msg.fs || msg.fileSize,
            fileType: msg.ft || msg.fileType,
            fileUrl: msg.fu || msg.fileUrl,
            replyTo: msg.r || msg.replyTo,
            em: msg.em || msg.e
        }));
    }
}

module.exports = MessageBatchService;