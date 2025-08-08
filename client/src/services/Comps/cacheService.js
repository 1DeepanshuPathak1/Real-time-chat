class CacheService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 300000;
        this.cacheCleanupInterval = null;
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached;
        }
        if (cached) {
            this.cache.delete(key);
        }
        return null;
    }

    set(key, value) {
        this.cache.set(key, {
            ...value,
            timestamp: Date.now()
        });
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear(roomId = null) {
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

    getSize() {
        return this.cache.size;
    }

    getKeys() {
        return Array.from(this.cache.keys());
    }

    getEntry(key) {
        return this.cache.get(key);
    }

    setEntry(key, value) {
        this.set(key, value);
    }

    cleanExpired() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    startCleanup() {
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanExpired();
        }, 60000);
    }

    stopCleanup() {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }
    }
}

export default new CacheService();