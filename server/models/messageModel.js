const {mongoose, messageDB} = require("../utils/util");

const messageSchema = new mongoose.Schema({
    message : {type:String, required:true},
    sender : {type:String, required:true},
    date : {type : Date, required : true},
})



const fetchMessages = async (roomID, cb)=>{
    console.log("getting messages from room : ",roomID);
    const messageModel = messageDB.model("Messages", messageSchema, `${roomID}`);
    messageModel.find()
    .then((messages)=>{
        if(messages.length>0){
            cb({messages : messages, message : "sucess"});
        }
        else{
            cb({message : "no messages"});
        }
    })
    .catch((err)=>{
        cb({message : err.errmsg, code : err.code});
    })

}


module.exports = {fetchMessages};