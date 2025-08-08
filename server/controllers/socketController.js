const MessageBatchService = require('../services/messageBatchService');

class SocketController {
    constructor(io, roomModel, db) {
        this.io = io;
        this.roomModel = roomModel;
        this.db = db;
        this.batchService = new MessageBatchService(db);
        this.setupSocketEvents();
    }

    decompressLZW(compressed) {
        try {
            const data = Buffer.from(compressed, 'base64').toString('binary');
            const codes = Array.from(data).map(c => c.charCodeAt(0));
            const dict = {};
            let dictSize = 256;
            let result = '';
            let w = String.fromCharCode(codes[0]);
            result += w;
            
            for (let i = 0; i < 256; i++) {
                dict[i] = String.fromCharCode(i);
            }
            
            for (let i = 1; i < codes.length; i++) {
                const k = codes[i];
                let entry;
                
                if (dict[k]) {
                    entry = dict[k];
                } else if (k === dictSize) {
                    entry = w + w[0];
                } else {
                    throw new Error('Invalid compression');
                }
                
                result += entry;
                dict[dictSize++] = w + entry[0];
                w = entry;
            }
            
            return Buffer.from(result, 'binary').toString('base64');
        } catch (error) {
            console.error('Decompression failed:', error);
            return compressed;
        }
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Socket connection established with id', socket.id);

            socket.on('user-connected', (userId) => {
                socket.join(userId);
                console.log(`User ${userId} connected with socket ${socket.id}`);
            });

            socket.on('send-message', async (data) => {
                const { roomID, message, sender, messageId, type, replyTo, fileName, fileSize, originalSize, fileType } = data;
                try {
                    let processedContent = message;
                    
                    if (type === 'document') {
                        const chunks = await this.batchService.getChunksFromCache(roomID, 1);
                        if (chunks.length > 0) {
                            const foundMessage = chunks[0].messages.find(msg => msg.id === messageId);
                            if (foundMessage && foundMessage.content) {
                                processedContent = foundMessage.content;
                            }
                        }
                    }

                    this.io.to(roomID).emit('received-message', {
                        roomID,
                        sender,
                        message: processedContent,
                        messageId,
                        timestamp: data.timestamp,
                        type: type || 'text',
                        fileName: fileName,
                        fileSize: fileSize,
                        originalSize: originalSize,
                        fileType: fileType,
                        ...(replyTo && { replyTo })
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

            socket.on('message-reaction', async (data) => {
                const { roomId, messageId, reactions, userName } = data;
                try {
                    socket.to(roomId).emit('reaction-updated', {
                        roomId,
                        messageId,
                        reactions: reactions,
                        userName
                    });
                } catch (error) {
                    console.error('Error broadcasting reaction:', error);
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