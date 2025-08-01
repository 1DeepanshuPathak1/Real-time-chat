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

            const senderDoc = await this.db.collection('users').doc(senderId).get();
            if (!senderDoc.exists) {
                return res.status(404).json({ error: 'Sender not found' });
            }
            
            const senderData = senderDoc.data();
            if (!senderData || !senderData.name || !senderData.email) {
                return res.status(400).json({ error: 'Invalid sender data' });
            }
            
            const sender = { id: senderDoc.id, ...senderData };

            let recipient;
            let recipientData;
            
            if (recipientIdentifier.includes('@')) {
                const recipientQuery = await this.db.collection('users')
                    .where('email', '==', recipientIdentifier)
                    .get();
                
                if (recipientQuery.empty) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                recipientData = recipientQuery.docs[0].data();
                recipient = { id: recipientQuery.docs[0].id, ...recipientData };
            } else {
                const recipientQuery = await this.db.collection('users')
                    .where('userCode', '==', recipientIdentifier.toUpperCase())
                    .get();
                
                if (recipientQuery.empty) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                recipientData = recipientQuery.docs[0].data();
                recipient = { id: recipientQuery.docs[0].id, ...recipientData };
            }

            if (!recipientData || !recipientData.name || !recipientData.email) {
                return res.status(400).json({ error: 'Invalid recipient data' });
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
                senderName: senderData.name,
                senderEmail: senderData.email,
                timestamp: new Date().toISOString(),
                status: 'pending'
            });

            this.io.to(recipient.id).emit('friend-request-received', {
                senderId: senderId,
                senderName: senderData.name,
                senderEmail: senderData.email,
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
                const userDoc = await this.db.collection('users').doc(userId).get();
                const senderDoc = await this.db.collection('users').doc(senderId).get();
                
                if (!userDoc.exists || !senderDoc.exists) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                const userData = userDoc.data();
                const senderData = senderDoc.data();
                
                if (!userData || !userData.name || !userData.email || !senderData || !senderData.name || !senderData.email) {
                    return res.status(400).json({ error: 'Invalid user data' });
                }
                
                const user = { id: userDoc.id, ...userData };
                const sender = { id: senderDoc.id, ...senderData };
                
                const roomId = await this.roomModel.createRoom(userId, senderId);

                await this.db.collection('users').doc(userId).collection('contacts').doc(senderId).set({
                    name: senderData.name,
                    email: senderData.email,
                    roomID: roomId,
                    unreadCount: 0
                });

                await this.db.collection('users').doc(senderId).collection('contacts').doc(userId).set({
                    name: userData.name,
                    email: userData.email,
                    roomID: roomId,
                    unreadCount: 0
                });

                this.io.to(senderId).emit('friend-request-accepted', {
                    userId: userId,
                    userName: userData.name,
                    userEmail: userData.email,
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