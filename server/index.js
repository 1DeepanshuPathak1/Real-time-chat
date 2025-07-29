require('dotenv').config();
const configureServer = require('./config/serverConfig');
const initializeFirebase = require('./config/firebaseConfig');
const UserModel = require('./models/userModel');
const RoomModel = require('./models/roomModel');
const FriendRequestController = require('./controllers/friendRequestController');
const RoomController = require('./controllers/roomController');
const HealthController = require('./controllers/healthController');
const SocketController = require('./controllers/socketController');
const AuthController = require('./controllers/authController');
const MessageController = require('./controllers/messageController');
const routes = require('./routes');
const rateLimit = require('express-rate-limit');

const db = initializeFirebase();

const userModel = new UserModel(db);
const roomModel = new RoomModel(db);

const { app, server, io } = configureServer();

const socketController = new SocketController(io, roomModel, db);

const healthController = new HealthController();
const roomController = new RoomController(db, userModel, roomModel);
const friendRequestController = new FriendRequestController(db, io, userModel, roomModel);
const authController = new AuthController(db, userModel);
const messageController = new MessageController(db);

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.url.includes('/health') || req.url.includes('/socket.io');
  }
});

app.use(limiter);

app.use('/', routes(healthController, roomController, friendRequestController, authController, messageController));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});