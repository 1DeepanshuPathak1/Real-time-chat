const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getFirestore();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/checkup', (req, res) => {
  res.send('Server is working');
});

app.post('/create-room', async (req, res) => {
  const { userId, contactEmail } = req.body;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const contactDoc = await db.collection('users').where('email', '==', contactEmail).get();
    
    if (!userDoc.exists || contactDoc.empty) {
      return res.status(404).send('User or contact not found');
    }

    const contact = contactDoc.docs[0].data();
    const roomId = [userId, contactDoc.docs[0].id].sort().join('-');
    
    await db.collection('rooms').doc(roomId).set({
      participants: [userId, contactDoc.docs[0].id],
      createdAt: new Date().toISOString()
    });

    await db.collection('users').doc(userId).collection('contacts').doc(contactDoc.docs[0].id).set({
      name: contact.name,
      email: contact.email,
      roomID: roomId,
      unreadCount: 0
    });

    res.status(200).send({ roomId });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

io.on('connection', (socket) => {
  console.log('Socket connection established with id', socket.id);

  socket.on('send-message', async (data) => {
    const { roomID, message, sender } = data;
    await db.collection('rooms').doc(roomID).collection('messages').add({
      sender,
      content: message,
      time: new Date().toISOString(),
      type: 'text'
    });
    socket.to(roomID).emit('received-message', { sender, message });
  });

  socket.on('send-poll', async (data) => {
    const { roomID, poll, sender } = data;
    await db.collection('rooms').doc(roomID).collection('messages').add({
      sender,
      content: poll,
      time: new Date().toISOString(),
      type: 'poll'
    });
    socket.to(roomID).emit('received-poll', { sender, poll });
  });

  socket.on('join-room', async (roomID) => {
    await socket.join(roomID);
    socket.emit('joined-room', { roomID, socketID: socket.id });
  });

  socket.on('leave-room', async (roomID) => {
    await socket.leave(roomID);
    socket.emit('left-room', { roomID, socketID: socket.id });
  });
});

server.listen(2000, () => {
  console.log('Server started on http://localhost:2000');
});