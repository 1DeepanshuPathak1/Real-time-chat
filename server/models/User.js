const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  roomID: String,
  userID: String,
  username: String
});

const userSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true,
    unique: true
  },
  username: String,
  contacts: [contactSchema]
});

module.exports = mongoose.model('User', userSchema);