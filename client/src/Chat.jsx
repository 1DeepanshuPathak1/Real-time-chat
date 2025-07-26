import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { SocketProvider, useSocket } from './services/SocketService';
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

function ChatContent() {
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  const { 
    socket, 
    isConnected, 
    networkError, 
    joinRoom, 
    leaveRoom, 
    sendMessage, 
    sendPoll,
    onMessageReceived,
    onPollReceived
  } = useSocket();

  const { startCamera, captureImage, stopCamera, stream } = useCameraHandlers(setMessages, videoRef, selectedContact);
  const { handleSendMessage, handleFileUpload } = useMessageHandlers(setMessages, socket, selectedContact, user);

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

  useEffect(() => {
    if (selectedContact && user && isConnected) {
      console.log('Joining room:', selectedContact.roomID);
      joinRoom(selectedContact.roomID);

      const q = query(
        collection(db, 'rooms', selectedContact.roomID, 'messages'),
        orderBy('time', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          time: new Date(doc.data().time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        console.log('Messages loaded:', messagesData.length);
        setMessages(messagesData);
      });

      return () => unsubscribe();
    }
  }, [selectedContact, user, isConnected, joinRoom]);

  useEffect(() => {
    const unsubscribeMessage = onMessageReceived((data) => {
      console.log('Received real-time message:', data);
    });

    const unsubscribePoll = onPollReceived((data) => {
      console.log('Received real-time poll:', data);
    });

    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribePoll) unsubscribePoll();
    };
  }, [onMessageReceived, onPollReceived]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleContactClick = (contact) => {
    if (selectedContact && isConnected) {
      leaveRoom(selectedContact.roomID);
    }
    setSelectedContact(contact);
  };

  const handlePollSend = async (pollData) => {
    if (selectedContact && user && isConnected) {
      const newPoll = {
        sender: user.email,
        content: pollData,
        time: new Date().toISOString(),
        type: 'poll'
      };

      try {
        await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), newPoll);
        sendPoll(selectedContact.roomID, pollData, user.email);
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

function Chat() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

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
    <SocketProvider user={user}>
      <ChatContent />
    </SocketProvider>
  );
}

export default Chat;