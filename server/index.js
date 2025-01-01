const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
mongoose.connect('mongodb://localhost:27017/chat-app');

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

app.post("/api/signin", async (req, res) => {
    try {
        const { userID } = req.body;
        let user = await User.findOne({ userID });
        
        if (!user) {
            user = await User.create({ 
                userID,
                username: `User_${userID}`,
                contacts: []
            });
        }
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

io.on("connection", (socket) => {
    console.log("Socket connection established with id", socket.id);
    
    socket.on("user-connected", async (userID) => {
        try {
            const user = await User.findOne({ userID });
            if (user) {
                socket.emit("contacts-list", user.contacts);
            }
        } catch (error) {
            console.error("Error fetching user:", error);
        }
    });

    socket.on("join-room", (roomID) => {
        socket.join(roomID);
        socket.emit("joined-room", { roomID, socketID: socket.id });
    });

    socket.on("message", (data) => {
        const { roomID, message } = data;
        socket.to(roomID).emit("received-message", { socketID: socket.id, message });
    });

    socket.on("leave-room", (roomID) => {
        socket.leave(roomID);
        socket.emit("left-room", { roomID, socketID: socket.id });
    });
});

server.listen(2000, () => {
    console.log("Server running on http://localhost:2000");
});