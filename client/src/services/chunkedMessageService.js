import { getFirestore, collection, doc, getDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

const db = getFirestore();

class ChunkedMessageService {
    constructor() {
        this.cache = new Map();
        this.unreadCache = new Map();
        this.messagesPerChunk = 50;
        this.cacheTimeout = 30000;
    }

    async getLatestMessages(roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/latest/${roomId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const formattedMessages = this.formatMessages(data.messages);

            this.cache.set(`${roomId}_latest`, {
                messages: formattedMessages,
                chunkId: data.id,
                hasMore: data.hasMore,
                timestamp: Date.now()
            });

            return {
                messages: formattedMessages,
                chunkId: data.id,
                hasMore: data.hasMore
            };
        } catch (error) {
            console.error('Error fetching latest messages:', error);
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async getOlderMessages(roomId, currentChunkId) {
        const cacheKey = `${roomId}_${currentChunkId}`;

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) {
                return cached;
            }
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/older/${roomId}/${currentChunkId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.messages) {
                return { messages: [], chunkId: null, hasMore: false };
            }

            const formattedMessages = this.formatMessages(data.messages);

            const result = {
                messages: formattedMessages,
                chunkId: data.id,
                hasMore: data.hasMore,
                timestamp: Date.now()
            };

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Error fetching older messages:', error);
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async getPendingMessages(roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/pending/${roomId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return this.formatMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching pending messages:', error);
            return [];
        }
    }

    formatMessages(messages) {
        return messages.map(msg => ({
            id: msg.i || msg.id,
            sender: msg.s || msg.sender,
            content: msg.c || msg.content,
            time: new Date(msg.t || msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: msg.t || msg.time,
            type: msg.ty || msg.type || 'text',
            fileName: msg.fn || msg.fileName,
            fileSize: msg.fs || msg.fileSize,
            fileType: msg.ft || msg.fileType,
            fileUrl: msg.fu || msg.fileUrl
        }));
    }

    async sendMessage(roomId, messageData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    ...messageData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.messageId;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    clearCache(roomId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(roomId)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    async getUnreadCount(roomId, userId) {
        const cacheKey = `unread_${roomId}_${userId}`;
        const cached = this.unreadCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.count;
        }

        try {
            const roomRef = doc(db, 'rooms', roomId);
            const roomDoc = await getDoc(roomRef);
            const lastReadTimestamp = roomDoc.data()?.[`lastReadBy_${userId}`] || 0;

            const response = await fetch(`${API_BASE_URL}/api/messages/unread-count/${roomId}?lastRead=${lastReadTimestamp}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    return cached ? cached.count : 0;
                }
                return 0;
            }

            const data = await response.json();
            const count = data.count || 0;

            this.unreadCache.set(cacheKey, {
                count,
                timestamp: Date.now()
            });

            return count;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return cached ? cached.count : 0;
        }
    }
    clearUnreadCache(roomId, userId) {
        const cacheKey = `unread_${roomId}_${userId}`;
        this.unreadCache.delete(cacheKey);
    }
}

export default new ChunkedMessageService();