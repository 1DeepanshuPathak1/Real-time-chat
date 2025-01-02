const express = require('express');
const http = require("http");

const { Server } = require("socket.io");

//mongo
const mongoose = require('mongoose');


//express
const app = express();
const server = http.createServer(app);

//socket io
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

async function startServer(){
    try{
        //starting database
        await mongoose.connect("mongodb://localhost:27017/Chats").then(()=>{
            console.log("database started");
        })

        //starting server
        server.listen(2000, ()=>{
            console.log("server started on http://localhost:2000");
        })
    }
    catch(err){
        console.error("Error while starting server : ", err);
    }
}

module.exports = {app, io, mongoose, express, server, startServer}