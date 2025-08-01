import { getFirestore, collection, doc, getDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

const db = getFirestore();

class ChunkedMessageService {
    constructor() {
        this.cache = new Map();
        this.messagesPerChunk = 50;
        this.cacheTimeout = 300000;
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

    async getLatestChunk(roomId) {
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

            return {
                id: data.id,
                messages: this.formatMessages(data.messages),
                hasMore: data.hasMore
            };
        } catch (error) {
            console.error('Error fetching latest chunk:', error);
            return { id: null, messages: [], hasMore: false };
        }
    }

    async getOlderMessages(roomId, currentChunkId) {
        const cacheKey = `${roomId}_${currentChunkId}`;

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
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
                if (response.status === 429) {
                    return [];
                }
                return [];
            }

            const data = await response.json();
            return this.formatMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching pending messages:', error);
            return [];
        }
    }

    async getMessagesFromRedis(roomId) {
        return await this.getPendingMessages(roomId);
    }

    formatMessages(messages) {
        return messages.map(msg => {
            const timestamp = msg.t || msg.timestamp || msg.time || Date.now();
            return {
                id: msg.i || msg.id,
                sender: msg.s || msg.sender,
                content: msg.c || msg.content,
                time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: timestamp,
                type: msg.ty || msg.type || 'text',
                fileName: msg.fn || msg.fileName,
                fileSize: msg.fs || msg.fileSize,
                fileType: msg.ft || msg.fileType,
                fileUrl: msg.fu || msg.fileUrl,
                replyTo: msg.r || msg.replyTo
            };
        });
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
}

export default new ChunkedMessageService();