class RoomModel {
    constructor(db) {
        this.db = db;
    }

    async createRoom(userId, contactId) {
        const roomId = [userId, contactId].sort().join('-');
        await this.db.collection('rooms').doc(roomId).set({
            participants: [userId, contactId],
            createdAt: new Date().toISOString()
        });
        return roomId;
    }

    async addMessage(roomId, sender, content, type = 'text', additionalData = {}) {
        const messageData = {
            sender,
            content,
            time: new Date().toISOString(),
            type,
            ...additionalData
        };
        
        return await this.db.collection('rooms').doc(roomId).collection('messages').add(messageData);
    }
}

module.exports = RoomModel;