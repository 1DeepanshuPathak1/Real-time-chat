const express = require("express");
const http = require("http");
const cors = require("cors");
const {Server} = require("socket.io");
app.use(cors());
app.use(express.json());

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors:{
        origin : 'http://localhost:5173/',
        methods : ['GET','POST']
    }
})

io.on("connection", (socket)=>{
    console.log("user joined with socket id", socket.id);
})


server.listen(2000, ()=>{
    console.log("server runnong on http://localhost/2000");
})