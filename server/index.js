require('dotenv').config();
const configureServer = require('./config/serverConfig');
const initializeFirebase = require('./config/firebaseConfig');
const { connectRedis } = require('./config/redisConfig');
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

const initializeRedis = async () => {
    try {
        await connectRedis();
        console.log('Redis initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Redis:', error);
        process.exit(1);
    }
};

const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
        if (messageController.batchService) {
            console.log('Flushing dirty cache data...');
            for (const cacheKey of messageController.batchService.dirtyChunks) {
                await messageController.batchService.flushDirtyChunk(cacheKey);
            }
        }
        
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
        
        setTimeout(() => {
            console.log('Forced shutdown');
            process.exit(1);
        }, 10000);
        
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
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

const startServer = async () => {
    try {
        await initializeRedis();
        
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();