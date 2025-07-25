class FriendRequestController {
    constructor(db, io, userModel, roomModel) {
        this.db = db;
        this.io = io;
        this.userModel = userModel;
        this.roomModel = roomModel;
    }

    async sendFriendRequest(req, res) {
        const { senderId, recipientIdentifier } = req.body;
        
        try {
            if (!senderId || !recipientIdentifier) {
                return res.status(400).json({ error: 'Missing senderId or recipientIdentifier' });
            }

            await this.userModel.ensureUserCode(senderId);
            const sender = await this.userModel.getUserById(senderId);
            
            if (!sender) {
                return res.status(404).json({ error: 'Sender not found' });
            }

            let recipient;
            if (recipientIdentifier.includes('@')) {
                recipient = await this.userModel.findUserByEmail(recipientIdentifier);
            } else {
                recipient = await this.userModel.findUserByCode(recipientIdentifier);
            }

            if (!recipient) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (senderId === recipient.id) {
                return res.status(400).json({ error: 'Cannot send friend request to yourself' });
            }

            const existingContact = await this.db.collection('users').doc(senderId).collection('contacts').doc(recipient.id).get();
            if (existingContact.exists) {
                return res.status(400).json({ error: 'User is already in your contacts' });
            }

            const existingRequest = await this.db.collection('users').doc(recipient.id).collection('friendRequests').doc(senderId).get();
            if (existingRequest.exists) {
                return res.status(400).json({ error: 'Friend request already sent' });
            }

            const reverseRequest = await this.db.collection('users').doc(senderId).collection('friendRequests').doc(recipient.id).get();
            if (reverseRequest.exists) {
                return res.status(400).json({ error: 'This user has already sent you a friend request' });
            }

            await this.db.collection('users').doc(recipient.id).collection('friendRequests').doc(senderId).set({
                senderId: senderId,
                senderName: sender.name,
                senderEmail: sender.email,
                timestamp: new Date().toISOString(),
                status: 'pending'
            });

            this.io.to(recipient.id).emit('friend-request-received', {
                senderId: senderId,
                senderName: sender.name,
                senderEmail: sender.email,
                timestamp: new Date().toISOString()
            });

            res.status(200).json({ message: 'Friend request sent successfully' });
        } catch (error) {
            console.error('Error sending friend request:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    async respondToFriendRequest(req, res) {
        const { userId, senderId, response } = req.body;
        
        try {
            if (!userId || !senderId || !['accept', 'reject'].includes(response)) {
                return res.status(400).json({ error: 'Invalid request parameters' });
            }

            const requestDoc = await this.db.collection('users').doc(userId).collection('friendRequests').doc(senderId).get();
            if (!requestDoc.exists) {
                return res.status(404).json({ error: 'Friend request not found' });
            }

            if (response === 'accept') {
                const user = await this.userModel.getUserById(userId);
                const sender = await this.userModel.getUserById(senderId);
                const roomId = await this.roomModel.createRoom(userId, senderId);

                await this.db.collection('users').doc(userId).collection('contacts').doc(senderId).set({
                    name: sender.name,
                    email: sender.email,
                    roomID: roomId,
                    unreadCount: 0
                });

                await this.db.collection('users').doc(senderId).collection('contacts').doc(userId).set({
                    name: user.name,
                    email: user.email,
                    roomID: roomId,
                    unreadCount: 0
                });

                this.io.to(senderId).emit('friend-request-accepted', {
                    userId: userId,
                    userName: user.name,
                    userEmail: user.email,
                    roomId: roomId
                });
            }

            await this.db.collection('users').doc(userId).collection('friendRequests').doc(senderId).delete();

            this.io.to(senderId).emit('friend-request-responded', {
                userId: userId,
                response: response
            });

            res.status(200).json({ message: `Friend request ${response}ed successfully` });
        } catch (error) {
            console.error('Error responding to friend request:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    async getFriendRequests(req, res) {
        const { userId } = req.params;
        
        try {
            const requestsSnapshot = await this.db.collection('users').doc(userId).collection('friendRequests').get();
            const requests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            res.status(200).json(requests);
        } catch (error) {
            console.error('Error fetching friend requests:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = FriendRequestController;
