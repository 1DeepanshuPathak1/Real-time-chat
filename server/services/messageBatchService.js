const { connectRedis } = require('../config/redisConfig');

class MessageBatchService {
    constructor(db) {
        this.db = db;
        this.batchSize = 50;
        this.batchTimeout = 5000;
        this.pendingBatches = new Map();
        this.flushInterval = setInterval(() => this.flushAllBatches(), this.batchTimeout);
    }

    async addMessageToBatch(roomId, messageData) {
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const timestamp = Date.now();
        
        const compressedMessage = {
            i: messageId,
            s: messageData.sender,
            c: messageData.content,
            t: timestamp,
            ty: messageData.type || 'text',
            ...(messageData.fileName && { fn: messageData.fileName }),
            ...(messageData.fileSize && { fs: messageData.fileSize }),
            ...(messageData.fileType && { ft: messageData.fileType }),
            ...(messageData.fileUrl && { fu: messageData.fileUrl }),
            ...(messageData.replyTo && { r: messageData.replyTo })
        };

        try {
            const redis = await connectRedis();
            await redis.lPush(`room:${roomId}:pending`, JSON.stringify(compressedMessage));
            await redis.expire(`room:${roomId}:pending`, 3600);

            if (!this.pendingBatches.has(roomId)) {
                this.pendingBatches.set(roomId, {
                    messages: [],
                    lastUpdate: Date.now()
                });
            }

            const batch = this.pendingBatches.get(roomId);
            batch.messages.push(compressedMessage);
            batch.lastUpdate = Date.now();

            if (batch.messages.length >= this.batchSize) {
                await this.flushBatch(roomId);
            }

            await this.updateRoomLastMessage(roomId, messageData.sender, messageData.content, timestamp);

        } catch (error) {
            console.error('Error adding message to batch:', error);
        }

        return messageId;
    }

    async flushBatch(roomId) {
        const batch = this.pendingBatches.get(roomId);
        if (!batch || batch.messages.length === 0) return;

        try {
            const chunkId = `${roomId}_${Date.now()}`;
            const chunkRef = this.db.collection('messageChunks').doc(chunkId);

            await chunkRef.set({
                roomId,
                messages: batch.messages,
                createdAt: new Date().toISOString(),
                messageCount: batch.messages.length
            });

            const roomChunksRef = this.db.collection('rooms').doc(roomId).collection('chunks');
            await roomChunksRef.doc(chunkId).set({
                chunkId,
                createdAt: new Date().toISOString(),
                messageCount: batch.messages.length
            });

            const redis = await connectRedis();
            await redis.del(`room:${roomId}:pending`);

            this.pendingBatches.delete(roomId);

            console.log(`Flushed ${batch.messages.length} messages for room ${roomId}`);
        } catch (error) {
            console.error('Error flushing batch:', error);
        }
    }

    async flushAllBatches() {
        const roomIds = Array.from(this.pendingBatches.keys());
        const currentTime = Date.now();

        for (const roomId of roomIds) {
            const batch = this.pendingBatches.get(roomId);
            if (batch && (currentTime - batch.lastUpdate) >= this.batchTimeout) {
                await this.flushBatch(roomId);
            }
        }
    }

    async getLatestChunk(roomId) {
        try {
            const chunksRef = this.db.collection('rooms').doc(roomId).collection('chunks');
            const chunksSnapshot = await chunksRef.orderBy('createdAt', 'desc').limit(1).get();

            if (chunksSnapshot.empty) {
                return { id: null, messages: [], hasMore: false };
            }

            const latestChunkDoc = chunksSnapshot.docs[0];
            const chunkData = latestChunkDoc.data();
            
            const chunkRef = this.db.collection('messageChunks').doc(chunkData.chunkId);
            const chunkDoc = await chunkRef.get();

            if (!chunkDoc.exists) {
                return { id: null, messages: [], hasMore: false };
            }

            const messages = chunkDoc.data().messages || [];
            const hasMore = chunksSnapshot.docs.length > 0;

            return {
                id: chunkData.chunkId,
                messages: messages.reverse(),
                hasMore
            };
        } catch (error) {
            console.error('Error getting latest chunk:', error);
            return { id: null, messages: [], hasMore: false };
        }
    }

    async getOlderChunk(roomId, currentChunkId) {
        try {
            const currentChunkRef = this.db.collection('rooms').doc(roomId).collection('chunks').doc(currentChunkId);
            const currentChunkDoc = await currentChunkRef.get();

            if (!currentChunkDoc.exists) {
                return null;
            }

            const currentChunkData = currentChunkDoc.data();
            const chunksRef = this.db.collection('rooms').doc(roomId).collection('chunks');
            
            const olderChunksSnapshot = await chunksRef
                .where('createdAt', '<', currentChunkData.createdAt)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (olderChunksSnapshot.empty) {
                return { id: null, messages: [], hasMore: false };
            }

            const olderChunkDoc = olderChunksSnapshot.docs[0];
            const olderChunkData = olderChunkDoc.data();
            
            const chunkRef = this.db.collection('messageChunks').doc(olderChunkData.chunkId);
            const chunkDoc = await chunkRef.get();

            if (!chunkDoc.exists) {
                return { id: null, messages: [], hasMore: false };
            }

            const messages = chunkDoc.data().messages || [];
            
            const hasMoreSnapshot = await chunksRef
                .where('createdAt', '<', olderChunkData.createdAt)
                .limit(1)
                .get();

            return {
                id: olderChunkData.chunkId,
                messages: messages.reverse(),
                hasMore: !hasMoreSnapshot.empty
            };
        } catch (error) {
            console.error('Error getting older chunk:', error);
            return null;
        }
    }

    async getMessagesFromRedis(roomId) {
        try {
            const redis = await connectRedis();
            const messages = await redis.lRange(`room:${roomId}:pending`, 0, -1);
            
            return messages.map(msg => JSON.parse(msg)).reverse();
        } catch (error) {
            console.error('Error getting messages from Redis:', error);
            return [];
        }
    }

    async updateRoomLastMessage(roomId, sender, content, timestamp) {
        try {
            const roomRef = this.db.collection('rooms').doc(roomId);
            await roomRef.update({
                lastMessage: content,
                lastMessageSender: sender,
                lastMessageTimestamp: timestamp,
                lastMessageTime: timestamp
            });
        } catch (error) {
            if (error.code === 'not-found') {
                const roomRef = this.db.collection('rooms').doc(roomId);
                await roomRef.set({
                    lastMessage: content,
                    lastMessageSender: sender,
                    lastMessageTimestamp: timestamp,
                    lastMessageTime: timestamp,
                    createdAt: new Date().toISOString()
                });
            } else {
                console.error('Error updating room last message:', error);
            }
        }
    }

    async markMessagesAsRead(roomId, userId, lastReadMessageId) {
        try {
            const roomRef = this.db.collection('rooms').doc(roomId);
            await roomRef.update({
                [`lastReadMessageId_${userId}`]: lastReadMessageId,
                [`lastReadTimestamp_${userId}`]: Date.now()
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    cleanup() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
}

module.exports = MessageBatchService;