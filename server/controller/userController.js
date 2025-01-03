const { fetchUser, addNewUser, fetchContacts} = require("../models/userModel");
const { fetchMessages } = require("../models/messageModel");

const findUser = (req,res)=>{
    // console.log("control at findUser");
    const userEmail = req.params.email;
    console.log("received user email : ", userEmail);

    fetchUser(userEmail, (data)=>{
        // console.log("control at callback of finduser");
        if(data.message == 'sucess'){
            if(data.userData!=null){
                res.status(200).send(data.userData);
            }
            else{
                res.status(500).send("no such user found");
            }
        }
        else{
            res.status(500).send(`Code : ${data.code}\n Message : ${data.message}`);
        }
        
    })
}

const createUser = (req,res)=>{
    const userDetails = {
        email : req.body.email,
        name : req.body.name
    }
    addNewUser(userDetails, (message)=>{
        if(message.message == 'sucess'){
            res.status(200).send("sucess");
        }
        else{
            if(message.code == 11000){
                res.status(409).send(`user already exists\n Code : ${message.code}\n Message : ${message.message}`);
            }
            else{
                res.status(500).send(`Error while creating user\n Code : ${message.code} Message : ${message.message}`);
            }
        }
    })
}

const findContacts = (req,res)=>{
    console.log("finding contacts");
    const userEmail = req.params.email;
    fetchContacts(userEmail, (data)=>{
        if(data.message == "sucess"){
            if(data.contacts==null){
                res.status(500).send("no contacts found");
            }
            else{
                res.status(200).send(data.contacts);
            }
        }
        else{
            res.status(500).send(`Failed to fetch contacts\n Code : ${data.code}\n Message : ${data.message}`);
        }
    });
}

const getMessages = (roomID)=>{
    fetchMessages(roomID, (data)=>{
        if(data.message = "sucess"){
            console.log("messages", data.messages);
        }
        else if(data.message = "no messages"){
            console.log("no messages in this room");
        }
        else{
            console.log(`Error while fetching messages\n Code ${data.code}\n Message : ${data.message}`);
        }
    })
}

module.exports = {findUser, createUser, findContacts, getMessages};