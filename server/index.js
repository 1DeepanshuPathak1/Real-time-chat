const {app, io, express, startServer} = require("./utils/util");
const cors = require("cors");
const {findUser, createUser, findContacts, getMessages} = require("./controller/userController");

//middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended : true}));

//server APIs
app.get("/checkup", (req,res)=>{res.send("server is working")});//server checkup req
app.get("/findUser/:email", findUser);
app.get("/getContacts/:email", findContacts);

app.post("/createUser", createUser);

//socket.io requests
io.on("connection", (socket) => {
    console.log("Socket connection established with id", socket.id);
    
    socket.on("message", (data) => {
        const { roomID, message } = data;
        socket.to(roomID).emit("received-message", { socketID: socket.id, message });
    });
    
    socket.on("join-room", async (roomID) => {
        await socket.join(roomID);
        socket.emit("joined-room", { roomID, socketID: socket.id });
        getMessages(roomID);
    });

    socket.on("leave-room", async (roomID) => {
        await socket.leave(roomID);
        socket.emit("left-room", { roomID, socketID: socket.id });
    });
});

//starting server
startServer();