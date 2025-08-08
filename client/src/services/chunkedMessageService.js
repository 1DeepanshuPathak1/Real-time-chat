import { getFirestore } from 'firebase/firestore';
import messageService from './Comps/messageService';
import cacheService from './Comps/cacheService';
import compressionService from './Comps/compressionService';

const db = getFirestore();

class ChunkedMessageService {
    constructor() {
        this.messageService = messageService;
        this.cacheService = cacheService;
        this.compressionService = compressionService;
        this.messagesPerChunk = 50;
        
        this.cacheService.startCleanup();
    }

    decompressLZW(compressed) {
        return this.compressionService.decompressLZW(compressed);
    }

    compressLZW(data) {
        return this.compressionService.compressLZW(data);
    }

    async getLatestMessages(roomId) {
        return await this.messageService.getLatestMessages(roomId);
    }

    async getLatestChunk(roomId) {
        return await this.messageService.getLatestChunk(roomId);
    }

    async getOlderMessages(roomId, currentChunkId) {
        return await this.messageService.getOlderMessages(roomId, currentChunkId);
    }

    async getPendingMessages(roomId) {
        return await this.messageService.getPendingMessages(roomId);
    }

    async getMessagesFromRedis(roomId) {
        return await this.messageService.getMessagesFromRedis(roomId);
    }

    async addReactionToMessage(roomId, reactionData) {
        return await this.messageService.addReactionToMessage(roomId, reactionData);
    }

    formatMessages(messages) {
        return this.messageService.formatMessages(messages);
    }

    async sendMessage(roomId, messageData) {
        return await this.messageService.sendMessage(roomId, messageData);
    }

    async fetchMessageById(roomId, messageId) {
        return await this.messageService.fetchMessageById(roomId, messageId);
    }

    async updateMessage(roomId, messageId, updates) {
        return await this.messageService.updateMessage(roomId, messageId, updates);
    }

    async deleteMessage(roomId, messageId) {
        return await this.messageService.deleteMessage(roomId, messageId);
    }

    async searchMessages(roomId, query, limit = 50) {
        return await this.messageService.searchMessages(roomId, query, limit);
    }

    async getMessagesBetweenDates(roomId, startDate, endDate) {
        return await this.messageService.getMessagesBetweenDates(roomId, startDate, endDate);
    }

    async getMessagesByType(roomId, messageType, limit = 50) {
        return await this.messageService.getMessagesByType(roomId, messageType, limit);
    }

    async getUnreadCount(roomId, userId) {
        return await this.messageService.getUnreadCount(roomId, userId);
    }

    async markMessagesRead(roomId, userId, lastReadMessageId) {
        return await this.messageService.markMessagesRead(roomId, userId, lastReadMessageId);
    }

    async getMessageReactions(roomId, messageId) {
        return await this.messageService.getMessageReactions(roomId, messageId);
    }

    async removeReactionFromMessage(roomId, messageId, emoji, userName) {
        return await this.messageService.removeReactionFromMessage(roomId, messageId, emoji, userName);
    }

    async getMessageStats(roomId) {
        return await this.messageService.getMessageStats(roomId);
    }

    async exportMessages(roomId, format = 'json', startDate = null, endDate = null) {
        return await this.messageService.exportMessages(roomId, format, startDate, endDate);
    }

    async clearCache(roomId = null) {
        this.cacheService.clear(roomId);
    }

    async preloadMessages(roomId, chunkCount = 3) {
        return await this.messageService.preloadMessages(roomId, chunkCount);
    }

    getCacheSize() {
        return this.cacheService.getSize();
    }

    getCacheKeys() {
        return this.cacheService.getKeys();
    }

    isCached(key) {
        return this.cacheService.has(key);
    }

    getCacheEntry(key) {
        return this.cacheService.getEntry(key);
    }

    setCacheEntry(key, value) {
        this.cacheService.setEntry(key, value);
    }

    cleanExpiredCache() {
        this.cacheService.cleanExpired();
    }

    startCacheCleanup() {
        this.cacheService.startCleanup();
    }

    stopCacheCleanup() {
        this.cacheService.stopCleanup();
    }
}

export default new ChunkedMessageService();