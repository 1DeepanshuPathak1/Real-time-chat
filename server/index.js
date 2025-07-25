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
const rateLimit = require('express-rate-limit');

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

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Set up routes
app.use('/', routes(healthController, roomController, friendRequestController));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});