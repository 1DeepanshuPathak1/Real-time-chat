import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

const db = getFirestore();

class ChunkedMessageService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 300000;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.messagesPerChunk = 50;
    }

    async getLatestMessages(roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/latest/${roomId}`);
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
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/latest/${roomId}`);
            const data = await response.json();

            return {
                id: data.id,
                messages: this.formatMessages(data.messages),
                hasMore: data.hasMore
            };
        } catch (error) {
            console.error('Error fetching latest chunk:', error);
            return await this.fallbackGetLatestChunk(roomId);
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
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/older/${roomId}/${currentChunkId}`);
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
            
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async getPendingMessages(roomId) {
        try {
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/pending/${roomId}`);
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
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/react`, {
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

            this.invalidateMessageCache(roomId);
            
            return await response.json();
        } catch (error) {
            console.error('Error adding reaction to message:', error);
            throw error;
        }
    }

    async sendMessage(roomId, messageData) {
        try {
            let processedData = { ...messageData };
            
            if (messageData.type === 'image' || messageData.type === 'document') {
                if (messageData.fileContent) {
                    processedData.content = await this.compressFile(messageData.fileContent, messageData.type);
                    processedData.originalSize = messageData.fileContent.size;
                    processedData.compressedSize = processedData.content.length;
                    delete processedData.fileContent;
                }
            }

            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    ...processedData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.invalidateMessageCache(roomId);
            
            return result.messageId;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async compressFile(file, type) {
        return new Promise((resolve) => {
            if (type === 'image') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = () => {
                    const maxSize = 500;
                    let { width, height } = img;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    let compressed = canvas.toDataURL('image/jpeg', 0.3);
                    const sizeInBytes = compressed.length * 0.75;
                    
                    if (sizeInBytes > 30000) {
                        canvas.width = width * 0.7;
                        canvas.height = height * 0.7;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        compressed = canvas.toDataURL('image/jpeg', 0.2);
                    }
                    
                    console.log(`Image compressed: ${file.size} bytes -> ${sizeInBytes} bytes (${Math.round((1 - sizeInBytes/file.size) * 100)}% reduction)`);
                    resolve(compressed);
                };
                
                img.src = URL.createObjectURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target.result;
                    const compressed = this.lzwCompress(text);
                    const compressionRatio = Math.round((1 - compressed.length/text.length) * 100);
                    console.log(`Document compressed: ${text.length} chars -> ${compressed.length} chars (${compressionRatio}% reduction)`);
                    resolve(compressed);
                };
                reader.readAsText(file);
            }
        });
    }

    lzwCompress(data) {
        if (!data || data.length === 0) return '';
        
        const dict = {};
        let result = [];
        let dictSize = 256;
        let w = '';
        
        for (let i = 0; i < 256; i++) {
            dict[String.fromCharCode(i)] = i;
        }
        
        for (let i = 0; i < data.length; i++) {
            const c = data[i];
            const wc = w + c;
            
            if (dict[wc] !== undefined) {
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
        
        return btoa(String.fromCharCode(...result.map(n => n & 0xFF)));
    }

    decompressContent(content, type) {
        if (type === 'image') {
            return content;
        } else if (type === 'document') {
            return this.lzwDecompress(content);
        }
        return content;
    }

    lzwDecompress(compressed) {
        try {
            if (!compressed) return '';
            
            const data = atob(compressed);
            const codes = Array.from(data).map(c => c.charCodeAt(0));
            const dict = {};
            let dictSize = 256;
            let result = '';
            
            if (codes.length === 0) return '';
            
            let w = String.fromCharCode(codes[0]);
            result += w;
            
            for (let i = 0; i < 256; i++) {
                dict[i] = String.fromCharCode(i);
            }
            
            for (let i = 1; i < codes.length; i++) {
                const k = codes[i];
                let entry;
                
                if (dict[k] !== undefined) {
                    entry = dict[k];
                } else if (k === dictSize) {
                    entry = w + w[0];
                } else {
                    return compressed;
                }
                
                result += entry;
                dict[dictSize++] = w + entry[0];
                w = entry;
            }
            
            return result;
        } catch (error) {
            return compressed;
        }
    }

    async getUnreadCount(roomId, lastRead) {
        try {
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/unread-count/${roomId}?lastRead=${lastRead}`);
            const data = await response.json();
            return data.count;
        } catch (error) {
            console.error('Error fetching unread count:', error);
            return 0;
        }
    }

    async markMessagesRead(roomId, userId, lastReadMessageId) {
        try {
            const response = await this.fetchWithRetry(`${API_BASE_URL}/api/messages/mark-read`, {
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

            return await response.json();
        } catch (error) {
            console.error('Error marking messages as read:', error);
            throw error;
        }
    }

    async fetchWithRetry(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (response.ok) {
                    return response;
                }

                if (response.status >= 400 && response.status < 500) {
                    throw new Error(`Client error: ${response.status}`);
                }

                throw new Error(`Server error: ${response.status}`);
            } catch (error) {
                lastError = error;
                
                if (attempt === this.retryAttempts) {
                    break;
                }

                if (error.message.includes('Client error')) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }

        throw lastError;
    }

    async fallbackToFirestore(roomId) {
        try {
            const messagesRef = collection(db, 'rooms', roomId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(this.messagesPerChunk));
            const snapshot = await getDocs(q);
            
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: new Date(doc.data().timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })).reverse();

            return {
                messages,
                chunkId: 'firestore_fallback',
                hasMore: messages.length === this.messagesPerChunk
            };
        } catch (error) {
            console.error('Firestore fallback failed:', error);
            return { messages: [], chunkId: null, hasMore: false };
        }
    }

    async fallbackGetLatestChunk(roomId) {
        try {
            const chunksRef = collection(db, 'rooms', roomId, 'messageChunks');
            const q = query(chunksRef, orderBy('createdAt', 'desc'), limit(1));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                return {
                    id: doc.id,
                    messages: this.formatMessages(doc.data().messages || []),
                    hasMore: true
                };
            } else {
                return await this.fallbackToFirestore(roomId);
            }
        } catch (error) {
            console.error('Firestore chunk fallback failed:', error);
            return { id: null, messages: [], hasMore: false };
        }
    }

    invalidateMessageCache(roomId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(roomId)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    clearExpiredCache() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    formatMessages(messages) {
        if (!Array.isArray(messages)) {
            return [];
        }

        return messages.map(msg => {
            if (!msg) return null;
            
            const timestamp = msg.t || msg.timestamp || msg.time || Date.now();
            let content = msg.c || msg.content;
            
            if (msg.ty === 'image' || msg.type === 'image') {
                content = content;
            } else if (msg.ty === 'document' || msg.type === 'document') {
                content = this.decompressContent(content, 'document');
            }
            
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
                replyTo: msg.r || msg.replyTo,
                em: msg.em
            };
        }).filter(Boolean);
    }

    startCacheCleanup() {
        setInterval(() => {
            this.clearExpiredCache();
        }, 60000);
    }
}

const chunkedMessageService = new ChunkedMessageService();
chunkedMessageService.startCacheCleanup();

export default chunkedMessageService;