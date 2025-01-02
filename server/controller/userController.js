const { fetchUser, addNewUser} = require("../models/userModel");

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

const createUser = async (req,res)=>{
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

module.exports = {findUser, createUser};