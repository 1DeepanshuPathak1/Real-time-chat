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

    async addMessage(roomId, sender, content, type = 'text') {
        return await this.db.collection('rooms').doc(roomId).collection('messages').add({
            sender,
            content,
            time: new Date().toISOString(),
            type
        });
    }
}

module.exports = RoomModel;
