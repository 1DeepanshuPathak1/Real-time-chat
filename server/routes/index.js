const express = require('express');
const router = express.Router();

module.exports = (healthController, roomController, friendRequestController, authController) => {
    // Health route
    router.get(['/health', '/'], healthController.getStatus.bind(healthController));

    // Auth routes
    router.post('/api/verify-user', authController.verifyUser.bind(authController));
    router.post('/api/create-user', authController.createUser.bind(authController));

    // Room routes
    router.post('/create-room', roomController.createRoom.bind(roomController));

    // Friend request routes
    router.post('/api/send-friend-request', friendRequestController.sendFriendRequest.bind(friendRequestController));
    router.post('/api/respond-friend-request', friendRequestController.respondToFriendRequest.bind(friendRequestController));
    router.get('/api/friend-requests/:userId', friendRequestController.getFriendRequests.bind(friendRequestController));

    return router;
};
