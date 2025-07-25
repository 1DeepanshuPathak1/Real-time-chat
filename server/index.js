require('dotenv').config();
const configureServer = require('./config/serverConfig');
const initializeFirebase = require('./config/firebaseConfig');
const UserModel = require('./models/userModel');
const RoomModel = require('./models/roomModel');
const SocketController = require('./controllers/socketController');
const FriendRequestController = require('./controllers/friendRequestController');
const RoomController = require('./controllers/roomController');
const HealthController = require('./controllers/healthController');
const routes = require('./routes');

// Initialize Firebase and get database instance
const db = initializeFirebase();

// Initialize models
const userModel = new UserModel(db);
const roomModel = new RoomModel(db);

// Configure server and get instances
const { app, server, io } = configureServer();

// Initialize controllers
const healthController = new HealthController();
const roomController = new RoomController(db, userModel, roomModel);
const friendRequestController = new FriendRequestController(db, io, userModel, roomModel);
const socketController = new SocketController(io, roomModel);

// Set up routes
app.use('/', routes(healthController, roomController, friendRequestController));

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});