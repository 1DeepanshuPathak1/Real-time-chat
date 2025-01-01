const express = require("express");
const http = require("http");
const cors = require("cors");
const {Server} = require("socket.io");

const app = express();


app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors:{
        origin : 'http://localhost:5173',
        methods : ['GET','POST']
    }
})

app.get("/", (req,res)=>{res.send("hi")});

io.on("connection", (socket)=>{
    console.log("scoket connectiong established with id ", socket.id);
    socket.send("hello");

    socket.on("message", (data)=>{
        const {roomID, message} = data;
        
        socket.to(roomID).emit("received-message", (socket.id, message));
    })
    socket.on("join-room", (roomID)=>{
        console.log(socket.id, " joined ", roomID);
        const data = {
            roomID : roomID,
            socketID : socket.id
        }
        socket.join(roomID);
        socket.emit("joined-room", data);
    })
    socket.on("leave-room", (roomID)=>{
        console.log(socket.id, " left room ", roomID);
        const data = {
            roomID : roomID,
            socketID: socket.id
        }
        socket.leave(roomID);
        socket.emit("left-room", data);
    })
})


server.listen(2000, ()=>{
    console.log("server running on http://localhost:2000");
})