import { useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
import { useUserStatus } from './components/UserStatusManager';
import { useAuthState } from './components/ChatComps/AuthStateManager';
import { useContactsManager } from './components/ChatComps/ContactManager';
import { useMessagesManager } from './components/ChatComps/MessagesManager';
import { useRealtimeMessageHandler } from './components/ChatComps/RealtimeMessageHandler';
import { useScrollManager } from './components/ChatComps/ScrollManager';
import { useUIState } from './components/ChatComps/UIStateManager';
import { useEventHandlers } from './components/ChatComps/EventHandler';
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
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const videoRef = useRef(null);

  const { user, loading } = useAuthState(auth, navigate);
  useUserStatus(user);

  const {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    onMessageReceived,
  } = useSocket();

  const { contacts, updateContactUnreadCount, moveContactToTop } = useContactsManager(user, db);

  const {
    inputMessage,
    setInputMessage,
    isRecording,
    setIsRecording,
    showEmojiPicker,
    setShowEmojiPicker,
    showAttachMenu,
    setShowAttachMenu,
    showCamera,
    setShowCamera,
    isDark,
    setIsDark,
    selectedContact,
    setSelectedContact,
    selectedContactStatus,
    setSelectedContactStatus,
    replyTo,
    setReplyTo
  } = useUIState();

  const {
    messages,
    setMessages,
    loadingOlderMessages,
    hasMoreMessages,
    pullDistance,
    isPulling,
    showStartMessage,
    hasScrolledToUnread,
    setHasScrolledToUnread,
    firstUnreadIndex,
    setFirstUnreadIndex,
    handleScroll
  } = useMessagesManager(selectedContact, user, isConnected, joinRoom, db);

  const { 
    startCamera, 
    captureImage, 
    confirmSendImage, 
    cancelCapture, 
    stopCamera, 
    stream, 
    capturedImage 
  } = useCameraHandlers(setMessages, videoRef, selectedContact, user);

  const { handleSendMessage, handleFileUpload } = useMessageHandlers(setMessages, socket, selectedContact, user);

  useRealtimeMessageHandler(onMessageReceived, selectedContact, setMessages, moveContactToTop, contacts);

  useScrollManager(selectedContact, user, messages, hasScrolledToUnread, loadingOlderMessages, setHasScrolledToUnread, setFirstUnreadIndex, messagesEndRef, db);

  const {
    handleContactClick,
    handleDocumentClick,
    handleThemeChange,
    handleSendMessageWrapper,
    handleContactStatusUpdate,
    handleReply,
    handleCancelReply,
    handleCameraConfirm,
    handleCameraCancel,
    handleCameraClose
  } = useEventHandlers(
    selectedContact,
    isConnected,
    leaveRoom,
    setSelectedContact,
    setReplyTo,
    updateContactUnreadCount,
    handleSendMessage,
    moveContactToTop,
    replyTo,
    setSelectedContactStatus,
    confirmSendImage,
    setShowCamera,
    stopCamera,
    cancelCapture
  );

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
          onThemeChange={(newTheme) => handleThemeChange(newTheme, setIsDark)}
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
                  contacts={contacts}
                />
              </div>
              {showCamera && (
                <CameraOverlay
                  videoRef={videoRef}
                  onCapture={captureImage}
                  onConfirm={handleCameraConfirm}
                  onCancel={handleCameraCancel}
                  onClose={handleCameraClose}
                  stream={stream}
                  capturedImage={capturedImage}
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
  const navigate = useNavigate();
  const { user, loading } = useAuthState(auth, navigate);

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