class SocketController {
    constructor(io, roomModel) {
        this.io = io;
        this.roomModel = roomModel;
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
                const { roomID, message, sender } = data;
                try {
                    await this.roomModel.addMessage(roomID, sender, message.content, message.type);
                    socket.to(roomID).emit('received-message', { sender, message: message.content });
                } catch (error) {
                    console.error('Error sending message:', error);
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
                    messageIds: data.messageIds,
                    readBy: data.userEmail,
                    readTimestamp: data.readTimestamp
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