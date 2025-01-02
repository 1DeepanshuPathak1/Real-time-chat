const {mongoose} = require("../utils/util");

const userSchema = mongoose.Schema({
  name : {type:String, required : true},
  email : {type:String, required : true, unique : true}
})

//models
const userModel = mongoose.model("Chats", userSchema, "users");

//functions
const fetchUser = (userEmail, cb)=>{
  // console.log("control at fetchuser");
  userModel.findOne({email : userEmail})
  .then((userData)=>{
    //send userData to controller in the callback function    
    cb({userData, message : 'sucess'});    
  })
  .catch((err)=>{
    cb({message : err.errmsg, code : err.code});
  })
}

const addNewUser = (userDetails, cb)=>{
  console.log(userDetails);
    userModel.create(userDetails)
    .then(()=>{
      cb({message : "sucess"});
    })
    .catch((err)=>{
      cb({message : err.errmsg, code : err.code});
    })
}

const fetchContacts = (email, cb)=>{
  userModel.findOne({email : email}, {contacts : true, _id : false})
  .then((contacts)=>{
    cb({contacts : contacts, message : "sucess"});
  })
  .catch((err)=>{
    cb({message : err.errmsg, code : err.code});
  })

}

module.exports = {fetchUser, addNewUser, fetchContacts};