const MessageBatchService = require('../services/messageBatchService');

class MessageController {
    constructor(db) {
        this.db = db;
        this.batchService = new MessageBatchService(db);
    }

    async sendMessage(req, res) {
        const { roomId, sender, content, type = 'text', fileName, fileSize, fileType, fileUrl, replyTo } = req.body;

        try {
            if (!roomId || !sender || !content) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const messageData = {
                sender,
                content,
                time: new Date().toISOString(),
                type,
                isDelivered: false,
                isRead: false,
                ...(fileName && { fileName }),
                ...(fileSize && { fileSize }),
                ...(fileType && { fileType }),
                ...(fileUrl && { fileUrl }),
                ...(replyTo && { replyTo })
            };

            const messageId = await this.batchService.addMessageToBatch(roomId, messageData);

            res.status(200).json({
                success: true,
                messageId,
                message: 'Message queued for delivery'
            });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }

    async getLatestMessages(req, res) {
        const { roomId } = req.params;

        try {
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
            }

            const latestChunk = await this.batchService.getLatestChunk(roomId);
            const pendingMessages = await this.batchService.getMessagesFromRedis(roomId);

            const allMessages = [...latestChunk.messages, ...pendingMessages];

            res.status(200).json({
                id: latestChunk.id,
                messages: allMessages,
                hasMore: latestChunk.hasMore
            });
        } catch (error) {
            console.error('Error fetching latest messages:', error);
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    }

    async getOlderMessages(req, res) {
        const { roomId, chunkId } = req.params;

        try {
            if (!roomId || !chunkId) {
                return res.status(400).json({ error: 'Room ID and Chunk ID are required' });
            }

            const olderChunk = await this.batchService.getOlderChunk(roomId, chunkId);

            if (!olderChunk) {
                return res.status(200).json({
                    id: null,
                    messages: [],
                    hasMore: false
                });
            }

            res.status(200).json(olderChunk);
        } catch (error) {
            console.error('Error fetching older messages:', error);
            res.status(500).json({ error: 'Failed to fetch older messages' });
        }
    }

    async getPendingMessages(req, res) {
        const { roomId } = req.params;

        try {
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
            }

            const pendingMessages = await this.batchService.getMessagesFromRedis(roomId);

            res.status(200).json({
                messages: pendingMessages
            });
        } catch (error) {
            console.error('Error fetching pending messages:', error);
            res.status(500).json({ error: 'Failed to fetch pending messages' });
        }
    }

    async getUnreadCount(req, res) {
        const { roomId } = req.params;
        const { lastRead } = req.query;

        try {
            if (!roomId) {
                return res.status(400).json({ error: 'Room ID is required' });
            }

            const lastReadTimestamp = parseInt(lastRead) || 0;
            const latestChunk = await this.batchService.getLatestChunk(roomId);
            const pendingMessages = await this.batchService.getMessagesFromRedis(roomId);

            const allMessages = [...latestChunk.messages, ...pendingMessages];
            const unreadCount = allMessages.filter(msg =>
                (msg.t || new Date(msg.time).getTime()) > lastReadTimestamp
            ).length;

            res.status(200).json({ count: unreadCount });
        } catch (error) {
            console.error('Error calculating unread count:', error);
            res.status(500).json({ error: 'Failed to calculate unread count' });
        }
    }

    async markMessagesRead(req, res) {
        const { roomId, userId, lastReadMessageId } = req.body;

        try {
            if (!roomId || !userId || !lastReadMessageId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            await this.batchService.markMessagesAsRead(roomId, userId, lastReadMessageId);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error marking messages as read:', error);
            res.status(500).json({ error: 'Failed to mark messages as read' });
        }
    }
}

module.exports = MessageController;