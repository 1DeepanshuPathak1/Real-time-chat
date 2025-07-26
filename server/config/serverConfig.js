const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const configureServer = () => {
    const app = express();
    const server = http.createServer(app);

    const allowedOrigins = [
        'https://potential-couscous-gvqx4q97w55fvx5w-5173.app.github.dev',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://real-time-chat-olive-five.vercel.app',
        'https://www.growhaven.xyz'
    ];

    if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
    }

    app.use(cors({
        origin: allowedOrigins,  
        methods: ['GET', 'POST'],
        credentials: true,
        optionsSuccessStatus: 200
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        next();
    });

    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type"],
            credentials: true
        }
    });

    return { app, server, io };
};

module.exports = configureServer;
