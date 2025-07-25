import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc } from 'firebase/firestore';
import { EmojiPickerComponent } from './components/EmojiPicker';
import { ParticlesBackground } from './components/ParticlesBackground';
import { ContactList } from './components/Contactlist';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { EmptyChat } from './components/EmptyChat';
import { CameraOverlay } from './components/CameraOverlay';
import { MessageInput } from './components/MessageInput';
import { PollCreator } from './components/poll-creator';
import { useCameraHandlers } from './components/CameraHandlers';
import { useMessageHandlers } from './components/MessageHandlers';
import './css/Chat.css';
import { useNavigate } from 'react-router-dom';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function Chat() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const { startCamera, captureImage, stopCamera, stream } = useCameraHandlers(setMessages, videoRef, selectedContact);
  const { handleSendMessage, handleFileUpload } = useMessageHandlers(setMessages, socketRef.current, selectedContact, user);

  // Handle authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('User authenticated:', currentUser.email);
        setUser(currentUser);
      } else {
        console.log('No user authenticated, redirecting to sign in');
        navigate('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (user && !socketRef.current) {
      console.log('Initializing socket connection for user:', user.uid);
      socketRef.current = io('https://chat-app-server-uwpx.onrender.com', {
        transports: ['websocket', 'polling'],  // Add polling as fallback
        path: '/socket.io',
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        auth: {
          token: user.uid
        }
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current.id);
        setNetworkError(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setNetworkError(true);
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socketRef.current.on('reconnect_attempt', (attempt) => {
        console.log('Attempting to reconnect:', attempt);
      });

      socketRef.current.on('received-message', (data) => {
        console.log('Received message:', data);
        setMessages((prev) => [...prev, {
          id: Date.now(),
          sender: data.sender,
          content: data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
        }]);
      });

      socketRef.current.on('received-poll', (data) => {
        console.log('Received poll:', data);
        setMessages((prev) => [...prev, {
          id: Date.now(),
          sender: data.sender,
          content: data.poll,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'poll'
        }]);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      stopCamera();
    };
  }, [user, stopCamera]);

  // Fetch contacts when user is authenticated
  useEffect(() => {
    if (user) {
      console.log('Fetching contacts for user:', user.uid);
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Contacts loaded:', contactsData);
        setContacts(contactsData);
      });

      return () => unsubscribe();
    }
  }, [user]);

  // Handle room joining and message fetching when contact is selected
  useEffect(() => {
    if (selectedContact && user && socketRef.current) {
      console.log('Joining room:', selectedContact.roomID);
      socketRef.current.emit('join-room', selectedContact.roomID);

      const q = query(collection(db, 'rooms', selectedContact.roomID, 'messages'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => new Date(a.time) - new Date(b.time));
        console.log('Messages loaded:', messagesData.length);
        setMessages(messagesData);
      });

      return () => unsubscribe();
    }
  }, [selectedContact, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleContactClick = (contact) => {
    if (selectedContact && socketRef.current) {
      socketRef.current.emit('leave-room', selectedContact.roomID);
    }
    setSelectedContact(contact);
  };

  const handlePollSend = async (pollData) => {
    if (selectedContact && user && socketRef.current) {
      const newPoll = {
        sender: user.email,
        content: pollData,
        time: new Date().toISOString(),
        type: 'poll'
      };

      try {
        await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), newPoll);
        socketRef.current.emit('send-poll', {
          roomID: selectedContact.roomID,
          poll: pollData,
          sender: user.email
        });
      } catch (error) {
        console.error('Error sending poll:', error);
      }
    }
  };

  const handleDocumentClick = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleThemeChange = (newTheme) => {
    setIsDark(newTheme);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`app-container ${isDark ? 'dark' : 'light'}`}>
      <div className="chat-container">
        <ContactList
          contacts={contacts}
          selectedContact={selectedContact}
          onContactClick={handleContactClick}
          user={user}
          socket={socketRef.current}
        />
        <div className="chat-window">
          {selectedContact ? (
            <>
              <ChatHeader selectedContact={selectedContact} onThemeChange={handleThemeChange} />
              <div className="messages-container">
                <ParticlesBackground />
                <MessageList
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  handleDocumentClick={handleDocumentClick}
                />
              </div>
              {showCamera && (
                <CameraOverlay
                  videoRef={videoRef}
                  onCapture={() => captureImage(selectedContact)}
                  onClose={() => {
                    stopCamera();
                    setShowCamera(false);
                  }}
                  stream={stream}
                />
              )}
              {showPollCreator && (
                <PollCreator
                  onClose={() => setShowPollCreator(false)}
                  onSend={handlePollSend}
                />
              )}
              <MessageInput
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputMessage, setInputMessage);
                }}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                showAttachMenu={showAttachMenu}
                setShowAttachMenu={setShowAttachMenu}
                fileInputRef={fileInputRef}
                documentInputRef={documentInputRef}
                startCamera={() => {
                  startCamera();
                  setShowCamera(true);
                  setShowAttachMenu(false);
                }}
                setShowPollCreator={setShowPollCreator}
              />
              <EmojiPickerComponent
                theme={isDark ? 'dark' : 'light'}
                show={showEmojiPicker}
                onEmojiClick={(emojiObject) => setInputMessage(prev => prev + emojiObject.emoji)}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e.target.files[0], 'image')}
                accept="image/*,video/*"
                style={{ display: 'none' }}
              />
              <input
                type="file"
                ref={documentInputRef}
                onChange={(e) => handleFileUpload(e.target.files[0], 'document')}
                accept=".doc,.docx,.pdf,.txt,.xls,.xlsx"
                style={{ display: 'none' }}
              />
            </>
          ) : (
            <div className="messages-container">
              <ParticlesBackground />
              <EmptyChat />
            </div>
          )}
        </div>
      </div>
      {networkError && (
        <div className="network-error-banner">
          Connection lost. Attempting to reconnect...
        </div>
      )}
    </div>
  );
}

export default Chat;