class RoomController {
    constructor(db, userModel, roomModel) {
        this.db = db;
        this.userModel = userModel;
        this.roomModel = roomModel;
    }

    async createRoom(req, res) {
        const { userId, contactEmail } = req.body;
        try {
            if (!userId || !contactEmail) {
                return res.status(400).json({ error: 'Missing userId or contactEmail' });
            }

            const user = await this.userModel.getUserById(userId);
            const contact = await this.userModel.findUserByEmail(contactEmail);

            if (!user || !contact) {
                return res.status(404).json({ error: 'User or contact not found' });
            }

            const roomId = await this.roomModel.createRoom(userId, contact.id);

            await this.db.collection('users').doc(userId).collection('contacts').doc(contact.id).set({
                name: contact.name,
                email: contact.email,
                roomID: roomId,
                unreadCount: 0
            });

            await this.db.collection('users').doc(contact.id).collection('contacts').doc(userId).set({
                name: user.name,
                email: user.email,
                roomID: roomId,
                unreadCount: 0
            });

            res.status(200).json({ roomId });
        } catch (error) {
            console.error('Error creating room:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = RoomController;
