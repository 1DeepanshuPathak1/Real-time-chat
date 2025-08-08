import { getFirestore } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

const db = getFirestore();

class ChunkedMessageService {
    constructor() {
        this.cache = new Map();
        this.messagesPerChunk = 50;
        this.cacheTimeout = 300000;
    }

    decompressLZW(compressed) {
        try {
            if (!compressed || typeof compressed !== 'string') {
                return compressed;
            }

            const binaryString = atob(compressed);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            
            const codes = Array.from(uint8Array);
            const dict = new Map();
            let dictSize = 256;
            let result = '';
            
            if (codes.length === 0) return compressed;
            
            let w = String.fromCharCode(codes[0]);
            result += w;
            
            for (let i = 0; i < 256; i++) {
                dict.set(i, String.fromCharCode(i));
            }
            
            for (let i = 1; i < codes.length; i++) {
                const k = codes[i];
                let entry;
                
                if (dict.has(k)) {
                    entry = dict.get(k);
                } else if (k === dictSize) {
                    entry = w + w[0];
                } else {
                    console.warn('Invalid compression code:', k);
                    return compressed;
                }
                
                result += entry;
                dict.set(dictSize++, w + entry[0]);
                w = entry;
            }
            
            const resultBytes = Array.from(result, c => c.charCodeAt(0));
            const resultBinary = String.fromCharCode(...resultBytes);
            return atob(resultBinary);
        } catch (error) {
            console.error('Decompression failed:', error);
            return compressed;
        }
    }

    compressLZW(data) {
        try {
            const dict = new Map();
            let dictSize = 256;
            const result = [];
            let w = '';
            
            for (let i = 0; i < 256; i++) {
                dict.set(String.fromCharCode(i), i);
            }
            
            for (let i = 0; i < data.length; i++) {
                const c = data[i];
                const wc = w + c;
                
                if (dict.has(wc)) {
                    w = wc;
                } else {
                    result.push(dict.get(w));
                    dict.set(wc, dictSize++);
                    w = c;
                }
            }
            
            if (w !== '') {
                result.push(dict.get(w));
            }
            
            const uint8Array = new Uint8Array(result);
            const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
            return btoa(binaryString);
        } catch (error) {
            console.error('LZW compression error:', error);
            return btoa(data);
        }
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

    async addReactionToMessage(roomId, reactionData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    ...reactionData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding reaction to message:', error);
            throw error;
        }
    }

    formatMessages(messages) {
        return messages.map(msg => {
            const timestamp = msg.t || msg.timestamp || msg.time || Date.now();
            let content = msg.c || msg.content;

            
            return {
                id: msg.i || msg.id,
                sender: msg.s || msg.sender,
                content: content,
                time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: timestamp,
                type: msg.ty || msg.type || 'text',
                fileName: msg.fn || msg.fileName,
                fileSize: msg.fs || msg.fileSize,
                fileType: msg.ft || msg.fileType,
                fileUrl: msg.fu || msg.fileUrl,
                originalSize: msg.os || msg.originalSize,
                compressedSize: msg.cs || msg.compressedSize,
                replyTo: msg.r || msg.replyTo,
                em: msg.em
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

    async fetchMessageById(roomId, messageId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/${roomId}/${messageId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.formatMessages([data.message])[0];
        } catch (error) {
            console.error('Error fetching message by ID:', error);
            return null;
        }
    }

    async updateMessage(roomId, messageId, updates) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/${roomId}/${messageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error updating message:', error);
            throw error;
        }
    }

    async deleteMessage(roomId, messageId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/${roomId}/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    async searchMessages(roomId, query, limit = 50) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/search/${roomId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    limit
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.formatMessages(data.messages || []);
        } catch (error) {
            console.error('Error searching messages:', error);
            return [];
        }
    }

    async getMessagesBetweenDates(roomId, startDate, endDate) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/range/${roomId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.formatMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching messages by date range:', error);
            return [];
        }
    }

    async getMessagesByType(roomId, messageType, limit = 50) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/type/${roomId}/${messageType}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                params: new URLSearchParams({ limit: limit.toString() })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.formatMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching messages by type:', error);
            return [];
        }
    }

    async getUnreadCount(roomId, userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/unread-count/${roomId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                params: new URLSearchParams({ userId })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.count || 0;
        } catch (error) {
            console.error('Error fetching unread count:', error);
            return 0;
        }
    }

    async markMessagesRead(roomId, userId, lastReadMessageId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    userId,
                    lastReadMessageId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error marking messages as read:', error);
            throw error;
        }
    }

    async getMessageReactions(roomId, messageId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/reactions/${roomId}/${messageId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.reactions || {};
        } catch (error) {
            console.error('Error fetching message reactions:', error);
            return {};
        }
    }

    async removeReactionFromMessage(roomId, messageId, emoji, userName) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    messageId,
                    emoji,
                    userName,
                    remove: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error removing reaction from message:', error);
            throw error;
        }
    }

    async getMessageStats(roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/stats/${roomId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.stats || {};
        } catch (error) {
            console.error('Error fetching message stats:', error);
            return {};
        }
    }

    async exportMessages(roomId, format = 'json', startDate = null, endDate = null) {
        try {
            const params = new URLSearchParams({ format });
            if (startDate) params.append('startDate', startDate.toISOString());
            if (endDate) params.append('endDate', endDate.toISOString());

            const response = await fetch(`${API_BASE_URL}/api/messages/export/${roomId}?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (format === 'json') {
                const data = await response.json();
                return this.formatMessages(data.messages || []);
            } else {
                return await response.blob();
            }
        } catch (error) {
            console.error('Error exporting messages:', error);
            return format === 'json' ? [] : null;
        }
    }

    async clearCache(roomId = null) {
        if (roomId) {
            const keysToDelete = [];
            for (const key of this.cache.keys()) {
                if (key.startsWith(roomId)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
        } else {
            this.cache.clear();
        }
    }

    async preloadMessages(roomId, chunkCount = 3) {
        try {
            const chunks = [];
            for (let i = 1; i <= chunkCount; i++) {
                const chunkId = `chunk_${i}`;
                const result = await this.getOlderMessages(roomId, chunkId);
                if (result.messages.length > 0) {
                    chunks.push(result);
                } else {
                    break;
                }
            }
            return chunks;
        } catch (error) {
            console.error('Error preloading messages:', error);
            return [];
        }
    }

    getCacheSize() {
        return this.cache.size;
    }

    getCacheKeys() {
        return Array.from(this.cache.keys());
    }

    isCached(key) {
        return this.cache.has(key);
    }

    getCacheEntry(key) {
        return this.cache.get(key);
    }

    setCacheEntry(key, value) {
        this.cache.set(key, {
            ...value,
            timestamp: Date.now()
        });
    }

    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    startCacheCleanup() {
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000); 
    }

    stopCacheCleanup() {
        clearInterval(this.cacheCleanupInterval);
    }
}

export default new ChunkedMessageService();