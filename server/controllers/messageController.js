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

            const chunks = await this.batchService.getChunksFromCache(roomId, 2);
            
            if (chunks.length === 0) {
                return res.status(200).json({
                    id: 'chunk_1',
                    messages: [],
                    hasMore: false
                });
            }

            const latestChunk = chunks[chunks.length - 1];
            const allMessages = chunks.flatMap(chunk => chunk.messages);

            res.status(200).json({
                id: latestChunk.id,
                messages: allMessages,
                hasMore: chunks.length > 1 || chunks[0].hasMore
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

            const result = await this.batchService.getOlderMessages(roomId, chunkId);

            res.status(200).json({
                id: result.chunkId,
                messages: result.messages,
                hasMore: result.hasMore
            });
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

    async addReaction(req, res) {
        const { roomId, messageId, emoji, userName, remove } = req.body;

        try {
            if (!roomId || !messageId || !emoji || !userName) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            await this.batchService.addReactionToMessage(roomId, messageId, emoji, userName, remove);

            res.status(200).json({
                success: true,
                message: 'Reaction updated successfully'
            });
        } catch (error) {
            console.error('Error updating reaction:', error);
            res.status(500).json({ error: 'Failed to update reaction' });
        }
    }

    async getUnreadCount(req, res) {
        const { roomId } = req.params;
        const { userId, lastRead } = req.query;

        try {
            if (!roomId || !userId) {
                return res.status(400).json({ error: 'Room ID and User ID are required' });
            }

            const cachedCount = await this.batchService.getCachedUnreadCount(roomId, userId);
            if (cachedCount !== null) {
                return res.status(200).json({ count: cachedCount });
            }

            const lastReadTimestamp = parseInt(lastRead) || 0;
            const chunks = await this.batchService.getChunksFromCache(roomId, 3);
            const allMessages = chunks.flatMap(chunk => chunk.messages);
            
            const unreadCount = allMessages.filter(msg => 
                msg.sender !== userId && 
                (msg.timestamp > lastReadTimestamp)
            ).length;

            await this.batchService.cacheUnreadCount(roomId, userId, unreadCount);

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
            await this.batchService.cacheUnreadCount(roomId, userId, 0);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error marking messages as read:', error);
            res.status(500).json({ error: 'Failed to mark messages as read' });
        }
    }

    async getContactList(req, res) {
        const { userId } = req.params;

        try {
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cachedContacts = await this.batchService.getCachedContactList(userId);
            if (cachedContacts) {
                return res.status(200).json({ contacts: cachedContacts });
            }

            const contactsRef = this.db.collection('users').doc(userId).collection('contacts');
            const snapshot = await contactsRef.get();
            
            const contacts = await Promise.all(
                snapshot.docs.map(async (doc) => {
                    const contactData = { id: doc.id, ...doc.data() };
                    
                    const cachedMetadata = await this.batchService.getCachedRoomMetadata(contactData.roomID);
                    if (cachedMetadata) {
                        const lastReadTimestamp = cachedMetadata[`lastReadTimestamp_${userId}`] || 0;
                        const unreadCount = await this.batchService.getCachedUnreadCount(contactData.roomID, userId) || 0;
                        
                        return {
                            ...contactData,
                            unreadCount,
                            lastMessageTime: cachedMetadata.lastMessageTimestamp || 0
                        };
                    }

                    const roomRef = this.db.collection('rooms').doc(contactData.roomID);
                    const roomDoc = await roomRef.get();
                    const roomData = roomDoc.data() || {};
                    
                    const lastMessageTimestamp = roomData.lastMessageTimestamp || 0;
                    const lastReadTimestamp = roomData[`lastReadTimestamp_${userId}`] || 0;
                    const unreadCount = Math.max(0, Math.floor((lastMessageTimestamp - lastReadTimestamp) / 1000));

                    await this.batchService.cacheRoomMetadata(contactData.roomID, roomData);
                    await this.batchService.cacheUnreadCount(contactData.roomID, userId, unreadCount);

                    return {
                        ...contactData,
                        unreadCount,
                        lastMessageTime: lastMessageTimestamp
                    };
                })
            );

            const sortedContacts = contacts.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            await this.batchService.cacheContactList(userId, sortedContacts);

            res.status(200).json({ contacts: sortedContacts });
        } catch (error) {
            console.error('Error fetching contact list:', error);
            res.status(500).json({ error: 'Failed to fetch contact list' });
        }
    }

    async getUserStatus(req, res) {
        const { userId } = req.params;

        try {
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const cachedStatus = await this.batchService.getCachedUserStatus(userId);
            if (cachedStatus) {
                return res.status(200).json(cachedStatus);
            }

            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                return res.status(404).json({ error: 'User not found' });
            }

            const userData = userDoc.data();
            const status = {
                isOnline: userData.isOnline || false,
                lastSeen: userData.lastSeenTimestamp ? 
                    this.formatLastSeen(userData.lastSeenTimestamp) : 'recently'
            };

            await this.batchService.cacheUserStatus(userId, status);

            res.status(200).json(status);
        } catch (error) {
            console.error('Error fetching user status:', error);
            res.status(500).json({ error: 'Failed to fetch user status' });
        }
    }

    formatLastSeen(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return 'long time ago';
    }
}

module.exports = MessageController;