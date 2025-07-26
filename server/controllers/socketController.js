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

            socket.on('send-poll', async (data) => {
                const { roomID, poll, sender } = data;
                try {
                    await this.roomModel.addMessage(roomID, sender, poll, 'poll');
                    socket.to(roomID).emit('received-poll', { sender, poll });
                } catch (error) {
                    console.error('Error sending poll:', error);
                }
            });

            socket.on('join-room', async (roomID) => {
                try {
                    await socket.join(roomID);
                    socket.emit('joined-room', { roomID, socketID: socket.id });
                } catch (error) {
                    console.error('Error joining room:', error);
                }
            });

            socket.on('leave-room', async (roomID) => {
                try {
                    await socket.leave(roomID);
                    socket.emit('left-room', { roomID, socketID: socket.id });
                } catch (error) {
                    console.error('Error leaving room:', error);
                }
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