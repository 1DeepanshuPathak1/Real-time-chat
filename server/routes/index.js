const express = require('express');
const router = express.Router();

module.exports = (healthController, roomController, friendRequestController, authController, messageController) => {
    router.get(['/health', '/'], healthController.getStatus.bind(healthController));

    router.post('/api/verify-user', authController.verifyUser.bind(authController));
    router.post('/api/create-user', authController.createUser.bind(authController));

    router.post('/api/create-room', roomController.createRoom.bind(roomController));

    router.post('/api/send-friend-request', friendRequestController.sendFriendRequest.bind(friendRequestController));
    router.post('/api/respond-friend-request', friendRequestController.respondToFriendRequest.bind(friendRequestController));
    router.get('/api/friend-requests/:userId', friendRequestController.getFriendRequests.bind(friendRequestController));

    router.post('/api/messages/send', messageController.sendMessage.bind(messageController));
    router.get('/api/messages/latest/:roomId', messageController.getLatestMessages.bind(messageController));
    router.get('/api/messages/older/:roomId/:chunkId', messageController.getOlderMessages.bind(messageController));
    router.get('/api/messages/pending/:roomId', messageController.getPendingMessages.bind(messageController));
    router.get('/api/messages/unread-count/:roomId', messageController.getUnreadCount.bind(messageController));
    router.post('/api/messages/mark-read', messageController.markMessagesRead.bind(messageController));

    return router;
};