const MessageBatchService = require('../services/messageBatchService');

class SocketController {
    constructor(io, roomModel, db) {
        this.io = io;
        this.roomModel = roomModel;
        this.db = db;
        this.batchService = new MessageBatchService(db);
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Socket connection established with id', socket.id);

            socket.on('user-connected', (userId) => {
                socket.join(userId);
                console.log(`User ${userId} connected with socket ${socket.id}`);
            });

            socket.on('send-message', async (data) => {
                const { roomID, message, sender, messageId } = data;
                try {
                    this.io.to(roomID).emit('received-message', {
                        roomID,
                        sender,
                        message,
                        messageId,
                        timestamp: data.timestamp
                    });

                    const roomRef = this.db.collection('rooms').doc(roomID);
                    const roomDoc = await roomRef.get();
                    const participants = roomDoc.data()?.participants || [];

                    participants.forEach(participantId => {
                        if (participantId !== sender) {
                            this.io.to(participantId).emit('unread-count-update', {
                                roomId: roomID,
                                increment: true
                            });
                        }
                    });
                } catch (error) {
                    console.error('Error broadcasting message:', error);
                }
            });

            socket.on('join-room', (roomId) => {
                socket.join(roomId);
                socket.to(roomId).emit('user-joined-room', {
                    roomId: roomId,
                    userEmail: socket.userEmail || socket.email,
                    userId: socket.userId
                });
            });

            socket.on('leave-room', async (roomID) => {
                try {
                    await socket.leave(roomID);
                    socket.emit('left-room', { roomID, socketID: socket.id });
                } catch (error) {
                    console.error('Error leaving room:', error);
                }
            });

            socket.on('mark-messages-read', (data) => {
                socket.to(data.roomId).emit('message-read', {
                    roomId: data.roomId,
                    lastReadMessageId: data.lastReadMessageId,
                    readBy: data.userEmail
                });
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected:', socket.id);
            });
        });
    }

    emitToUser(userId, event, data) {
        this.io.to(userId).emit(event, data);
    }
}

module.exports = SocketController;