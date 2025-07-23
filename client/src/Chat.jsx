import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc } from 'firebase/firestore';
import { EmojiPickerComponent } from './components/EmojiPicker';
import { ParticlesBackground } from './components/ParticlesBackground';
import { ContactList } from './components/Contactlist';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { CameraOverlay } from './components/CameraOverlay';
import { MessageInput } from './components/MessageInput';
import { PollCreator } from './components/poll-creator';
import { useCameraHandlers } from './components/CameraHandlers';
import { useMessageHandlers } from './components/MessageHandlers';
import './css/Chat.css';

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

function Chat({ user }) {
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);

  const { startCamera, captureImage, stopCamera, stream } = useCameraHandlers(setMessages, videoRef);
  const { handleSendMessage, handleFileUpload } = useMessageHandlers(setMessages, socketRef.current, selectedContact);

  useEffect(() => {
    socketRef.current = io.connect('http://localhost:2000', { query: { userId: user.uid } });

    const fetchContacts = async () => {
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      onSnapshot(q, (snapshot) => {
        const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactsData);
        if (contactsData.length > 0 && !selectedContact) {
          setSelectedContact(contactsData[0]);
        }
      });
    };

    fetchContacts();

    socketRef.current.on('received-message', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        sender: data.sender,
        content: data.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      }]);
    });

    socketRef.current.on('received-poll', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        sender: data.sender,
        content: data.poll,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'poll'
      }]);
    });

    return () => {
      socketRef.current.disconnect();
      stopCamera();
    };
  }, [user.uid]);

  useEffect(() => {
    if (selectedContact) {
      socketRef.current.emit('join-room', selectedContact.roomID);
      const q = query(collection(db, 'rooms', selectedContact.roomID, 'messages'));
      onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData);
      });
    }
  }, [selectedContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleContactClick = (contact) => {
    if (selectedContact) {
      socketRef.current.emit('leave-room', selectedContact.roomID);
    }
    setSelectedContact(contact);
  };

  const handlePollSend = async (pollData) => {
    if (selectedContact) {
      const newPoll = {
        sender: user.email,
        content: pollData,
        time: new Date().toISOString(),
        type: 'poll'
      };
      await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), newPoll);
      socketRef.current.emit('send-poll', {
        roomID: selectedContact.roomID,
        poll: pollData,
        sender: user.email
      });
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

  return (
    <div className={`app-container ${isDark ? 'dark' : 'light'}`}>
      <div className="chat-container">
        <ContactList
          contacts={contacts}
          selectedContact={selectedContact}
          onContactClick={handleContactClick}
        />
        <div className="chat-window">
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
              onCapture={captureImage}
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
        </div>
      </div>
    </div>
  );
}

export default Chat;