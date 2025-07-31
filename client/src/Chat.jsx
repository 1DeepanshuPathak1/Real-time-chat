import React, { useState, useRef, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, orderBy, limit, getDocs, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { SocketProvider, useSocket } from './services/SocketService';
import { EmojiPickerComponent } from './components/MessageComps/EmojiPicker';
import { ReplyMessage } from './components/MessageComps/ReplyMessage';
import { ParticlesBackground } from './components/MessageComps/ParticlesBackground';
import { ContactList } from './components/ContactComps/Contactlist';
import { ChatHeader } from './components/ContactComps/ChatHeader';
import { MessageList } from './components/MessageComps/MessageList';
import { EmptyChat } from './components/ContactComps/EmptyChat';
import { CameraOverlay } from './components/CameraComps/CameraOverlay';
import { MessageInput } from './components/MessageComps/MessageInput';
import { useCameraHandlers } from './components/CameraComps/CameraHandlers';
import { useMessageHandlers } from './components/MessageComps/MessageHandlers';
import { useUserStatus, useContactStatus } from './components/UserStatusManager';
import chunkedMessageService from './services/chunkedMessageService';
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
  const [currentChunkId, setCurrentChunkId] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showStartMessage, setShowStartMessage] = useState(false);
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);
  const [selectedContactStatus, setSelectedContactStatus] = useState({ isOnline: false, lastSeen: 'recently' });
  const [replyTo, setReplyTo] = useState(null);
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

  const updateContactUnreadCount = useCallback((roomId, updates) => {
    setContacts(prevContacts => 
      prevContacts.map(contact => 
        contact.roomID === roomId 
          ? { ...contact, ...updates }
          : contact
      )
    );
  }, []);

  const moveContactToTop = useCallback((roomId) => {
    setContacts(prevContacts => {
      const contactIndex = prevContacts.findIndex(c => c.roomID === roomId);
      if (contactIndex > 0) {
        const updatedContacts = [...prevContacts];
        const contact = updatedContacts.splice(contactIndex, 1)[0];
        contact.lastMessageTime = Date.now();
        updatedContacts.unshift(contact);
        return updatedContacts;
      }
      return prevContacts;
    });
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const contactsData = await Promise.all(
          snapshot.docs.map(async (contactDoc) => {
            const contactData = { id: contactDoc.id, ...contactDoc.data() };
            
            try {
              const roomRef = doc(db, 'rooms', contactData.roomID);
              const roomDoc = await getDoc(roomRef);
              const roomData = roomDoc.data();
              const lastMessageTimestamp = roomData?.lastMessageTimestamp || roomData?.lastMessageTime || 0;
              const lastReadTimestamp = roomData?.[`lastReadTimestamp_${user.uid}`] || 0;
              const lastReadMessageId = roomData?.[`lastReadMessageId_${user.uid}`];
              
              const messagesQuery = query(
                collection(db, 'rooms', contactData.roomID, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(50)
              );
              const messagesSnapshot = await getDocs(messagesQuery);
              
              let unreadCount = 0;
              if (lastReadMessageId) {
                let foundLastRead = false;
                for (const msgDoc of messagesSnapshot.docs) {
                  const msgData = msgDoc.data();
                  if (msgData.sender !== user.email) {
                    if (msgDoc.id === lastReadMessageId) {
                      foundLastRead = true;
                      break;
                    }
                    if (!foundLastRead) {
                      unreadCount++;
                    }
                  }
                }
              } else {
                unreadCount = messagesSnapshot.docs.filter(doc => 
                  doc.data().sender !== user.email && 
                  doc.data().timestamp > lastReadTimestamp
                ).length;
              }
              
              return {
                ...contactData,
                unreadCount,
                lastMessageTime: typeof lastMessageTimestamp === 'string' 
                  ? new Date(lastMessageTimestamp).getTime() 
                  : lastMessageTimestamp
              };
            } catch (error) {
              console.error('Error fetching room data:', error);
              return {
                ...contactData,
                unreadCount: 0,
                lastMessageTime: 0
              };
            }
          })
        );
        
        const sortedContacts = contactsData.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        setContacts(sortedContacts);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (selectedContact && user && isConnected) {
      console.log('Joining room:', selectedContact.roomID);
      joinRoom(selectedContact.roomID);

      setHasScrolledToUnread(false);
      setFirstUnreadIndex(-1);
      setMessages([]);
      setCurrentChunkId(null);
      setHasMoreMessages(true);
      setShowStartMessage(false);
      setPullDistance(0);
      setIsPulling(false);
      setReplyTo(null);

      const loadInitialMessages = async () => {
        try {
          const result = await chunkedMessageService.getLatestMessages(selectedContact.roomID);
          
          console.log('Initial messages loaded:', result.messages.length);
          setMessages(result.messages);
          setCurrentChunkId(result.chunkId);
          setHasMoreMessages(result.hasMore);

          if (result.messages.length === 0) {
            setShowStartMessage(true);
          }

          const roomRef = doc(db, 'rooms', selectedContact.roomID);
          const roomDoc = await getDoc(roomRef);
          const lastReadTimestamp = roomDoc.data()?.[`lastReadTimestamp_${user.uid}`] || 0;
          
          const firstUnreadIdx = result.messages.findIndex(msg => 
            msg.sender !== user.email && 
            (msg.timestamp > lastReadTimestamp)
          );
          
          setFirstUnreadIndex(firstUnreadIdx);

        } catch (error) {
          console.error('Error loading initial messages:', error);
        }
      };

      loadInitialMessages();
    }
  }, [selectedContact, user, isConnected, joinRoom]);

  const loadOlderMessages = async () => {
    if (!selectedContact || !currentChunkId || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);

    try {
      const result = await chunkedMessageService.getOlderMessages(selectedContact.roomID, currentChunkId);

      if (result.messages.length > 0) {
        setMessages(prevMessages => [...result.messages, ...prevMessages]);
        setCurrentChunkId(result.chunkId);
        setHasMoreMessages(result.hasMore);

        if (!result.hasMore) {
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
    const unsubscribeMessage = onMessageReceived(async (data) => {
      console.log('Received real-time message:', data);
      
      if (selectedContact && data.roomID === selectedContact.roomID) {
        const newMessage = {
          id: data.messageId || Date.now(),
          sender: data.sender,
          content: data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: data.timestamp || Date.now(),
          type: data.type || 'text',
          fileName: data.fileName,
          replyTo: data.replyTo
        };
        
        setMessages(prevMessages => {
          const exists = prevMessages.find(msg => msg.id === newMessage.id);
          if (exists) return prevMessages;
          return [...prevMessages, newMessage];
        });
      } else {
        moveContactToTop(data.roomID);
        
        setContacts(prevContacts => 
          prevContacts.map(contact => 
            contact.roomID === data.roomID 
              ? { 
                  ...contact, 
                  unreadCount: (contact.unreadCount || 0) + 1,
                  lastMessageTime: Date.now()
                }
              : contact
          )
        );
      }
    });

    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
    };
  }, [onMessageReceived, selectedContact, moveContactToTop]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToFirstUnreadMessage = useCallback(async () => {
    if (!selectedContact || !user || messages.length === 0 || hasScrolledToUnread) return;
    
    try {
      const roomRef = doc(db, 'rooms', selectedContact.roomID);
      const roomDoc = await getDoc(roomRef);
      const lastReadTimestamp = roomDoc.data()?.[`lastReadTimestamp_${user.uid}`] || 0;
      
      const firstUnreadIdx = messages.findIndex(msg => 
        msg.sender !== user.email && 
        (msg.timestamp > lastReadTimestamp)
      );
      
      setFirstUnreadIndex(firstUnreadIdx);
      
      if (firstUnreadIdx !== -1) {
        setTimeout(() => {
          const messageElements = document.querySelectorAll('.message');
          const firstUnreadElement = messageElements[firstUnreadIdx];
          if (firstUnreadElement) {
            firstUnreadElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHasScrolledToUnread(true);
          }
        }, 300);
      } else {
        setTimeout(() => {
          scrollToBottom();
          setHasScrolledToUnread(true);
        }, 300);
      }
    } catch (error) {
      console.error('Error scrolling to first unread:', error);
      setTimeout(() => {
        scrollToBottom();
        setHasScrolledToUnread(true);
      }, 300);
    }
  }, [selectedContact, user, messages, hasScrolledToUnread]);

  useEffect(() => {
    if (messages.length > 0 && !loadingOlderMessages && selectedContact && !hasScrolledToUnread) {
      scrollToFirstUnreadMessage();
    } else if (messages.length > 0 && !loadingOlderMessages && hasScrolledToUnread && messages[messages.length - 1]?.sender === user?.email) {
      scrollToBottom();
    }
  }, [messages, loadingOlderMessages, selectedContact, hasScrolledToUnread, scrollToFirstUnreadMessage, user]);

  const handleContactClick = (contact) => {
    if (selectedContact && isConnected) {
      leaveRoom(selectedContact.roomID);
    }
    setSelectedContact(contact);
    setReplyTo(null);
    updateContactUnreadCount(contact.roomID, { unreadCount: 0 });
  };

  const handleDocumentClick = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleThemeChange = (newTheme) => {
    setIsDark(newTheme);
  };

  const handleSendMessageWrapper = useCallback(async (inputMessage, setInputMessage) => {
    const messageData = {
      content: inputMessage,
      replyTo: replyTo
    };
    
    await handleSendMessage(messageData.content, setInputMessage, messageData.replyTo);
    if (selectedContact) {
      moveContactToTop(selectedContact.roomID);
    }
    setReplyTo(null);
  }, [handleSendMessage, selectedContact, moveContactToTop, replyTo]);

  const handleContactStatusUpdate = useCallback((contactEmail, status) => {
    if (selectedContact && selectedContact.email === contactEmail) {
      setSelectedContactStatus(status);
    }
  }, [selectedContact]);

  const handleReply = (message) => {
    setReplyTo(message);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
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
          onContactUpdate={updateContactUnreadCount}
          onContactStatusUpdate={handleContactStatusUpdate}
        />
        <div className="chat-window">
          {selectedContact ? (
            <>
              <ChatHeader 
                selectedContact={selectedContact} 
                isDark={isDark} 
                contactStatus={selectedContactStatus} 
              />
              <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
                <ParticlesBackground key={selectedContact?.roomID} isDark={isDark} />
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
                <MessageList
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  handleDocumentClick={handleDocumentClick}
                  currentUserEmail={user.email}
                  selectedContact={selectedContact}
                  user={user}
                  firstUnreadIndex={firstUnreadIndex}
                  showStartMessage={!hasMoreMessages || messages.length === 0}
                  isDark={isDark}
                  onReply={handleReply}
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
              {replyTo && (
                <ReplyMessage
                  replyTo={replyTo}
                  onCancel={handleCancelReply}
                />
              )}
              <MessageInput
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessageWrapper(inputMessage, setInputMessage);
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
              <ParticlesBackground key="empty-chat" isDark={isDark} />
              <EmptyChat />
            </div>
          )}
        </div>
      </div>
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