const express = require('express');
const router = express.Router();

module.exports = (healthController, roomController, friendRequestController) => {
    // Health routes
    router.get('/', healthController.getStatus);
    router.get('/health', healthController.getHealth);
    router.get('/checkup', healthController.getCheckup);

    // Room routes
    router.post('/create-room', roomController.createRoom.bind(roomController));

    // Friend request routes
    router.post('/send-friend-request', friendRequestController.sendFriendRequest.bind(friendRequestController));
    router.post('/respond-friend-request', friendRequestController.respondToFriendRequest.bind(friendRequestController));
    router.get('/friend-requests/:userId', friendRequestController.getFriendRequests.bind(friendRequestController));

    return router;
};
