import { useEffect, useRef, useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { MessageStatusIndicator, isMessageRead, getUnreadCount } from './MessageStatus';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageInfoModal } from './MessageInfoModal';
import { ReplyMessageDisplay, findReplyToMessage } from './ReplyMessage';
import { MessageContent } from './MessageContent';
import { useImagePreview } from './MessageUtils';
import { MessageReactions, useMessageReactions } from './MessageReactions';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import './css/MessageList.css'

const db = getFirestore();

export const MessageList = ({ messages, messagesEndRef, currentUserEmail, selectedContact, user, firstUnreadIndex, showStartMessage, isDark, onReply, contacts }) => {
  const { socket } = useSocket();
  const lastReadMessageId = useRef(null);
  const hasScrolledToUnread = useRef(false);
  const [messageReactions, setMessageReactions] = useState({});
  const { imagePreview, previewImage, closeImagePreview } = useImagePreview();
  const { handleReactionClick } = useMessageReactions(messageReactions, setMessageReactions, selectedContact, user, socket);

  useEffect(() => {
    const fetchLastReadMessageId = async () => {
      if (!user || !selectedContact) return;
      
      try {
        const roomRef = doc(db, 'rooms', selectedContact.roomID);
        const roomDoc = await getDoc(roomRef);
        const roomData = roomDoc.data();
        lastReadMessageId.current = roomData?.[`lastReadMessageId_${user.uid}`] || null;
      } catch (error) {
        console.error('Error fetching last read message ID:', error);
      }
    };

    fetchLastReadMessageId();
  }, [user, selectedContact]);

  useEffect(() => {
    const fetchMessageReactions = () => {
      if (!messages.length) return;
      
      const reactions = {};
      messages.forEach(message => {
        if (message.em) {
          reactions[message.id] = message.em;
        }
      });
      setMessageReactions(reactions);
    };

    fetchMessageReactions();
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 && selectedContact && !hasScrolledToUnread.current) {
      const scrollToTarget = () => {
        if (firstUnreadIndex !== -1) {
          const messageElements = document.querySelectorAll('.message');
          const firstUnreadElement = messageElements[firstUnreadIndex];
          if (firstUnreadElement) {
            firstUnreadElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        } else {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: 'smooth' 
          });
        }
        hasScrolledToUnread.current = true;
      };

      setTimeout(scrollToTarget, 100);
    }
  }, [messages, firstUnreadIndex, selectedContact, messagesEndRef]);

  useEffect(() => {
    if (selectedContact) {
      hasScrolledToUnread.current = false;
    }
  }, [selectedContact]);

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !selectedContact || messages.length === 0) return;

      const unreadMessages = messages.filter(msg => 
        msg.sender !== currentUserEmail
      );

      if (unreadMessages.length === 0) return;

      const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];
      
      try {
        const roomRef = doc(db, 'rooms', selectedContact.roomID);
        await updateDoc(roomRef, {
          [`lastReadMessageId_${user.uid}`]: lastUnreadMessage.id,
          [`lastReadTimestamp_${user.uid}`]: Date.now()
        });

        lastReadMessageId.current = lastUnreadMessage.id;

        if (socket) {
          socket.emit('mark-messages-read', {
            roomId: selectedContact.roomID,
            lastReadMessageId: lastUnreadMessage.id,
            userId: user.uid,
            userEmail: user.email
          });
        }

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    const timeoutId = setTimeout(markMessagesAsRead, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, user, selectedContact, socket, currentUserEmail]);

  useEffect(() => {
    if (socket) {
      const handleReceivedMessage = (data) => {
        if (data.roomID === selectedContact?.roomID) {
          const existingMessageIndex = messages.findIndex(msg => msg.id === data.messageId);
          
          if (existingMessageIndex !== -1) {
            return;
          }

          const newMessage = {
            id: data.messageId,
            sender: data.sender,
            content: data.message,
            time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: data.timestamp,
            type: data.type || 'text',
            fileName: data.fileName,
            fileSize: data.fileSize,
            fileType: data.fileType,
            originalSize: data.originalSize,
            isDelivered: true,
            isRead: false,
            ...(data.replyTo && { replyTo: data.replyTo })
          };
        }
      };

      const handleReactionUpdate = (data) => {
        if (data.roomId === selectedContact?.roomID) {
          setMessageReactions(prev => ({
            ...prev,
            [data.messageId]: data.reactions
          }));
        }
      };

      socket.on('received-message', handleReceivedMessage);
      socket.on('reaction-updated', handleReactionUpdate);
      
      return () => {
        socket.off('received-message', handleReceivedMessage);
        socket.off('reaction-updated', handleReactionUpdate);
      };
    }
  }, [socket, selectedContact, messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="messages-scroll">
        {showStartMessage && (
          <div className="conversation-start">
            <div className="start-message">
              <h3>👋 Say hello to {selectedContact?.name}!</h3>
              <p>This is the beginning of your conversation.</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return (
    <div className="messages-scroll">
      {showStartMessage && (
        <div className="conversation-start">
          <div className="start-message">
            <h3>👋 Say hello to {selectedContact?.name}!</h3>
            <p>This is the beginning of your conversation.</p>
          </div>
        </div>
      )}
      {messages.map((message, index) => (
        <div key={`message-wrapper-${message.id}-${index}`}>
          {index === firstUnreadIndex && firstUnreadIndex !== -1 && (
            <div className="unread-messages-divider">
              <div className="unread-line"></div>
              <span className="unread-text">{getUnreadCount(messages, firstUnreadIndex, currentUserEmail)} unread messages</span>
              <div className="unread-line"></div>
            </div>
          )}
          <div
            className={`message ${message.sender === currentUserEmail ? 'sent' : 'received'} ${message.isSending ? 'sending' : ''} ${message.hasError ? 'error' : ''}`}
            data-message-id={message.id}
          >
            <div className={`message-content ${message.type === 'image' ? 'image-message' : ''} ${message.type === 'document' ? 'document-message-container' : ''}`}>
              {message.replyTo && (
                <ReplyMessageDisplay 
                  replyTo={findReplyToMessage(messages, message.replyTo) || { 
                    id: message.replyTo, 
                    content: 'Message not found', 
                    sender: 'Unknown' 
                  }} 
                  currentUserEmail={currentUserEmail}
                  messages={messages}
                />
              )}
              <MessageContent message={message} onPreviewImage={previewImage} />
              <div className="message-meta">
                <span className="message-time">{message.time}</span>
                <MessageStatusIndicator 
                  message={{
                    ...message,
                    isRead: isMessageRead(message, currentUserEmail, lastReadMessageId.current, messages)
                  }}
                  currentUser={user}
                  selectedContact={selectedContact}
                />
              </div>
              {<MessageReactions 
                message={message} 
                messageReactions={messageReactions} 
                user={user} 
                contacts={contacts} 
                selectedContact={selectedContact} 
                isDark={isDark} 
                onReactionClick={handleReactionClick} 
              />}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
      
      {imagePreview.show && (
        <div className="image-preview-modal">
          <div className="image-preview-overlay" onClick={closeImagePreview}>
            <div className="image-preview-container" onClick={(e) => e.stopPropagation()}>
              <div className="image-preview-header">
                <span className="image-preview-title">{imagePreview.fileName || 'Image'}</span>
                <button className="image-preview-close" onClick={closeImagePreview}>
                  <FiX />
                </button>
              </div>
              <div className="image-preview-content">
                <img src={imagePreview.src} alt="Preview" className="preview-image" />
              </div>
              <div className="image-preview-actions">
                <button 
                  className="preview-download-btn"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = imagePreview.src;
                    link.download = imagePreview.fileName || `image_${Date.now()}.jpg`;
                    link.click();
                  }}
                >
                  <FiDownload /> Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <MessageContextMenu
        messages={messages}
        selectedContact={selectedContact}
        user={user}
        messageReactions={messageReactions}
        setMessageReactions={setMessageReactions}
        contacts={contacts}
        isDark={isDark}
        onReply={onReply}
        socket={socket}
      />
    </div>
  );
};