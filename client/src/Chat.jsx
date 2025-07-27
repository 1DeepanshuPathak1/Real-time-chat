import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { SocketProvider, useSocket } from './services/SocketService';
import { EmojiPickerComponent } from './components/MessageComps/EmojiPicker';
import { ParticlesBackground } from './components/MessageComps/ParticlesBackground';
import { ContactList } from './components/ContactComps/Contactlist';
import { ChatHeader } from './components/ContactComps/ChatHeader';
import { MessageList } from './components/MessageComps/MessageList';
import { EmptyChat } from './components/ContactComps/EmptyChat';
import { CameraOverlay } from './components/CameraComps/CameraOverlay';
import { MessageInput } from './components/MessageComps/MessageInput';
import { useCameraHandlers } from './components/CameraComps/CameraHandlers';
import { useMessageHandlers } from './components/MessageComps/MessageHandlers';
import { useUserStatus } from './components/UserStatusManager';
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
  const [isDark, setIsDark] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessage, setOldestMessage] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showStartMessage, setShowStartMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useUserStatus(user);

  const { 
    socket, 
    isConnected, 
    networkError, 
    joinRoom, 
    leaveRoom, 
    onMessageReceived,
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
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data()
        }));
        setContacts(contactsData);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (selectedContact && user && isConnected) {
      console.log('Joining room:', selectedContact.roomID);
      joinRoom(selectedContact.roomID);

      setMessages([]);
      setOldestMessage(null);
      setHasMoreMessages(true);
      setShowStartMessage(false);
      setPullDistance(0);
      setIsPulling(false);

      const loadInitialMessages = async () => {
        try {
          const q = query(
            collection(db, 'rooms', selectedContact.roomID, 'messages'),
            orderBy('time', 'desc'),
            limit(50)
          );
          
          const snapshot = await getDocs(q);
          const messagesData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            time: new Date(doc.data().time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: doc.data().time
          }));
          
          const sortedMessages = messagesData.reverse();
          console.log('Initial messages loaded:', sortedMessages.length);
          setMessages(sortedMessages);
          
          if (messagesData.length > 0) {
            setOldestMessage(snapshot.docs[snapshot.docs.length - 1]);
            
            const realtimeQ = query(
              collection(db, 'rooms', selectedContact.roomID, 'messages'),
              orderBy('time', 'asc')
            );
            
            const unsubscribe = onSnapshot(realtimeQ, (realtimeSnapshot) => {
              const allMessages = realtimeSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: new Date(doc.data().time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: doc.data().time
              }));
              
              setMessages(allMessages);
            });
            
            return unsubscribe;
          } else {
            const realtimeQ = query(
              collection(db, 'rooms', selectedContact.roomID, 'messages'),
              orderBy('time', 'asc')
            );
            
            const unsubscribe = onSnapshot(realtimeQ, (realtimeSnapshot) => {
              const allMessages = realtimeSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                time: new Date(doc.data().time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: doc.data().time
              }));
              
              setMessages(allMessages);
            });
            
            return unsubscribe;
          }
          
          if (messagesData.length < 50) {
            setHasMoreMessages(false);
            setShowStartMessage(true);
          }
        } catch (error) {
          console.error('Error loading initial messages:', error);
        }
      };

      const unsubscribePromise = loadInitialMessages();
      
      return () => {
        unsubscribePromise.then(unsubscribe => {
          if (unsubscribe) unsubscribe();
        });
      };
    }
  }, [selectedContact, user, isConnected, joinRoom]);

  const loadOlderMessages = async () => {
    if (!selectedContact || !oldestMessage || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);
    
    try {
      const q = query(
        collection(db, 'rooms', selectedContact.roomID, 'messages'),
        orderBy('time', 'desc'),
        startAfter(oldestMessage),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const olderMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: new Date(doc.data().time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: doc.data().time
      }));

      if (olderMessages.length > 0) {
        const sortedOlderMessages = olderMessages.reverse();
        setMessages(prevMessages => [...sortedOlderMessages, ...prevMessages]);
        setOldestMessage(snapshot.docs[snapshot.docs.length - 1]);
        
        if (olderMessages.length < 50) {
          setHasMoreMessages(false);
          setShowStartMessage(true);
        }
      } else {
        setHasMoreMessages(false);
        setShowStartMessage(true);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    
    if (scrollTop <= 0 && hasMoreMessages && !loadingOlderMessages) {
      setIsPulling(true);
    } else if (isPulling && scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
    }
    
    if (isPulling && scrollTop < 0) {
      const distance = Math.abs(scrollTop);
      setPullDistance(Math.min(distance, 80));
      
      if (distance > 60) {
        setIsPulling(false);
        setPullDistance(0);
        e.target.scrollTop = 0;
        loadOlderMessages();
      }
    }
  };

  useEffect(() => {
    const unsubscribeMessage = onMessageReceived((data) => {
      console.log('Received real-time message:', data);
    });

    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
    };
  }, [onMessageReceived]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0 && !loadingOlderMessages) {
      scrollToBottom();
    }
  }, [messages, loadingOlderMessages]);

  const handleContactClick = (contact) => {
    if (selectedContact && isConnected) {
      leaveRoom(selectedContact.roomID);
    }
    setSelectedContact(contact);
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
          onThemeChange={handleThemeChange}
          isDark={isDark}
        />
        <div className="chat-window">
          {selectedContact ? (
            <>
              <ChatHeader selectedContact={selectedContact} isDark={isDark} />
              <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
                <ParticlesBackground />
                <div 
                  className={`pull-to-refresh ${isPulling ? 'pulling' : ''}`}
                  style={{ transform: `translateY(${pullDistance}px)` }}
                >
                  <div className="pull-indicator">
                    <div className="pull-spinner"></div>
                    <span>{pullDistance > 40 ? 'Release to load' : 'Pull to load older messages'}</span>
                  </div>
                </div>
                {loadingOlderMessages && (
                  <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                  </div>
                )}
                {(!hasMoreMessages || messages.length === 0) && (
                  <div className="conversation-start">
                    <div className="start-message">
                      <h3>👋 Say hello to {selectedContact?.name}!</h3>
                      <p>This is the beginning of your conversation.</p>
                    </div>
                  </div>
                )}
                <MessageList
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  handleDocumentClick={handleDocumentClick}
                  currentUserEmail={user.email}
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