require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}

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

const allowedOrigins = [
  'https://potential-couscous-gvqx4q97w55fvx5w-5173.app.github.dev',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost:5173'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  }
});

const generateUserCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const ensureUserCode = async (userId) => {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists && !userDoc.data().userCode) {
      let userCode;
      let codeExists = true;
      
      while (codeExists) {
        userCode = generateUserCode();
        const existingUser = await db.collection('users').where('userCode', '==', userCode).get();
        codeExists = !existingUser.empty;
      }
      
      await userRef.update({ userCode });
      return userCode;
    }
    
    return userDoc.data()?.userCode;
  } catch (error) {
    console.error('Error ensuring user code:', error);
    return null;
  }
};

app.get('/', (req, res) => {
  res.json({ message: 'Chat Server API is running', status: 'OK' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/checkup', (req, res) => {
  res.send('Server is working');
});

app.post('/create-room', async (req, res) => {
  const { userId, contactEmail } = req.body;
  try {
    if (!userId || !contactEmail) {
      return res.status(400).json({ error: 'Missing userId or contactEmail' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const contactDoc = await db.collection('users').where('email', '==', contactEmail).get();

    if (!userDoc.exists || contactDoc.empty) {
      return res.status(404).json({ error: 'User or contact not found' });
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

    res.status(200).json({ roomId });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/send-friend-request', async (req, res) => {
  const { senderId, recipientIdentifier } = req.body;
  
  try {
    if (!senderId || !recipientIdentifier) {
      return res.status(400).json({ error: 'Missing senderId or recipientIdentifier' });
    }

    await ensureUserCode(senderId);
    
    const senderDoc = await db.collection('users').doc(senderId).get();
    if (!senderDoc.exists) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    let recipientDoc;
    if (recipientIdentifier.includes('@')) {
      const recipientQuery = await db.collection('users').where('email', '==', recipientIdentifier).get();
      if (recipientQuery.empty) {
        return res.status(404).json({ error: 'User not found with this email' });
      }
      recipientDoc = recipientQuery.docs[0];
    } else {
      const recipientQuery = await db.collection('users').where('userCode', '==', recipientIdentifier.toUpperCase()).get();
      if (recipientQuery.empty) {
        return res.status(404).json({ error: 'User not found with this code' });
      }
      recipientDoc = recipientQuery.docs[0];
    }

    const recipientId = recipientDoc.id;

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const existingContact = await db.collection('users').doc(senderId).collection('contacts').doc(recipientId).get();
    if (existingContact.exists) {
      return res.status(400).json({ error: 'User is already in your contacts' });
    }

    const existingRequest = await db.collection('users').doc(recipientId).collection('friendRequests').doc(senderId).get();
    if (existingRequest.exists) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    const reverseRequest = await db.collection('users').doc(senderId).collection('friendRequests').doc(recipientId).get();
    if (reverseRequest.exists) {
      return res.status(400).json({ error: 'This user has already sent you a friend request' });
    }

    await db.collection('users').doc(recipientId).collection('friendRequests').doc(senderId).set({
      senderId: senderId,
      senderName: senderDoc.data().name,
      senderEmail: senderDoc.data().email,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });

    io.to(recipientId).emit('friend-request-received', {
      senderId: senderId,
      senderName: senderDoc.data().name,
      senderEmail: senderDoc.data().email,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/respond-friend-request', async (req, res) => {
  const { userId, senderId, response } = req.body;
  
  try {
    if (!userId || !senderId || !['accept', 'reject'].includes(response)) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const requestDoc = await db.collection('users').doc(userId).collection('friendRequests').doc(senderId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (response === 'accept') {
      const userDoc = await db.collection('users').doc(userId).get();
      const senderDoc = await db.collection('users').doc(senderId).get();
      
      const roomId = [userId, senderId].sort().join('-');

      await db.collection('rooms').doc(roomId).set({
        participants: [userId, senderId],
        createdAt: new Date().toISOString()
      });

      await db.collection('users').doc(userId).collection('contacts').doc(senderId).set({
        name: senderDoc.data().name,
        email: senderDoc.data().email,
        roomID: roomId,
        unreadCount: 0
      });

      await db.collection('users').doc(senderId).collection('contacts').doc(userId).set({
        name: userDoc.data().name,
        email: userDoc.data().email,
        roomID: roomId,
        unreadCount: 0
      });

      io.to(senderId).emit('friend-request-accepted', {
        userId: userId,
        userName: userDoc.data().name,
        userEmail: userDoc.data().email,
        roomId: roomId
      });
    }

    await db.collection('users').doc(userId).collection('friendRequests').doc(senderId).delete();

    io.to(senderId).emit('friend-request-responded', {
      userId: userId,
      response: response
    });

    res.status(200).json({ message: `Friend request ${response}ed successfully` });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/friend-requests/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const requestsSnapshot = await db.collection('users').doc(userId).collection('friendRequests').get();
    const requests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

io.on('connection', (socket) => {
  console.log('Socket connection established with id', socket.id);

  socket.on('user-connected', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

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

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});