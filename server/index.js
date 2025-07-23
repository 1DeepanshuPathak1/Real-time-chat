require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Debug environment variables
console.log('Environment Variables:', {
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY ? 'Defined' : 'Undefined'
});

if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error('Error: FIREBASE_PRIVATE_KEY is not defined in .env');
  process.exit(1);
}

// Fix the private key parsing
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Remove quotes if they exist
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}

// Replace escaped newlines with actual newlines
privateKey = privateKey.replace(/\\n/g, '\n');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey
};

try {
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

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
    if (!userId || !contactEmail) {
      return res.status(400).send('Missing userId or contactEmail');
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const contactDoc = await db.collection('users').where('email', '==', contactEmail).get();

    if (!userDoc.exists || contactDoc.empty) {
      return res.status(404).send('User or contact not found');
    }

    const contact = contactDoc.docs[0].data();
    const contactId = contactDoc.docs[0].id;
    const roomId = [userId, contactId].sort().join('-');

    await db.collection('rooms').doc(roomId).set({
      participants: [userId, contactId],
      createdAt: new Date().toISOString()
    });

    await db.collection('users').doc(userId).collection('contacts').doc(contactId).set({
      name: contact.name,
      email: contact.email,
      roomID: roomId,
      unreadCount: 0
    });

    await db.collection('users').doc(contactId).collection('contacts').doc(userId).set({
      name: userDoc.data().name,
      email: userDoc.data().email,
      roomID: roomId,
      unreadCount: 0
    });

    res.status(200).send({ roomId });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).send('Server error');
  }
});

io.on('connection', (socket) => {
  console.log('Socket connection established with id', socket.id);

  socket.on('send-message', async (data) => {
    const { roomID, message, sender } = data;
    try {
      await db.collection('rooms').doc(roomID).collection('messages').add({
        sender,
        content: message,
        time: new Date().toISOString(),
        type: 'text'
      });
      socket.to(roomID).emit('received-message', { sender, message });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('send-poll', async (data) => {
    const { roomID, poll, sender } = data;
    try {
      await db.collection('rooms').doc(roomID).collection('messages').add({
        sender,
        content: poll,
        time: new Date().toISOString(),
        type: 'poll'
      });
      socket.to(roomID).emit('received-poll', { sender, poll });
    } catch (error) {
      console.error('Error sending poll:', error);
    }
  });

  socket.on('join-room', async (roomID) => {
    try {
      await socket.join(roomID);
      socket.emit('joined-room', { roomID, socketID: socket.id });
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  socket.on('leave-room', async (roomID) => {
    try {
      await socket.leave(roomID);
      socket.emit('left-room', { roomID, socketID: socket.id });
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});