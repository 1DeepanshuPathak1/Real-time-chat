import { useEffect, useRef, useState } from 'react';
import { FiFile, FiDownload, FiEye, FiX } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageInfoModal } from './MessageInfoModal';
import { ReplyMessageDisplay } from './ReplyMessage';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import chunkedMessageService from '../../services/chunkedMessageService';
import './css/MessageReactions.css';
import './css/MessageList.css'

const db = getFirestore();

export const MessageList = ({ messages, messagesEndRef, currentUserEmail, selectedContact, user, firstUnreadIndex, showStartMessage, isDark, onReply, contacts }) => {
  const { socket } = useSocket();
  const lastReadMessageId = useRef(null);
  const hasScrolledToUnread = useRef(false);
  const [contextMenu, setContextMenu] = useState({ show: false, position: { x: 0, y: 0 }, message: null });
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessages, setMessages] = useState(messages || []);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [messageReactions, setMessageReactions] = useState({});
  const [imagePreview, setImagePreview] = useState({ show: false, src: '', fileName: '' });

  const downloadDocument = async (message) => {
    try {
      let downloadData;
      let fileName = message.fileName || 'document';
      
      if (message.content.startsWith('data:')) {
        downloadData = message.content;
      } else {
        const blob = new Blob([message.content], { type: message.fileType || 'application/octet-stream' });
        downloadData = URL.createObjectURL(blob);
      }
      
      const link = document.createElement('a');
      link.href = downloadData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (!message.content.startsWith('data:')) {
        URL.revokeObjectURL(downloadData);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const downloadImage = async (message) => {
    try {
      const link = document.createElement('a');
      link.href = message.content;
      link.download = message.fileName || `image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image');
    }
  };

  const previewImage = (src, fileName) => {
    setImagePreview({ show: true, src, fileName });
  };

  const closeImagePreview = () => {
    setImagePreview({ show: false, src: '', fileName: '' });
  };

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
    const handleClickOutside = (event) => {
      if (contextMenu.show && !event.target.closest('.message-context-menu') && !event.target.closest('.context-emoji-picker')) {
        handleCloseContextMenu();
      }
      if (imagePreview.show && !event.target.closest('.image-preview-modal')) {
        closeImagePreview();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        handleCloseContextMenu();
        setShowMessageInfo(false);
        closeImagePreview();
      }
    };

    if (contextMenu.show || showMessageInfo || imagePreview.show) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [contextMenu.show, showMessageInfo, imagePreview.show]);

  useEffect(() => {
    if (socket) {
      const handleReceivedMessage = (data) => {
        if (data.roomID === selectedContact?.roomID) {
          setMessages(prevMessages => {
            const existingMessageIndex = prevMessages.findIndex(msg => msg.id === data.messageId);
            
            if (existingMessageIndex !== -1) {
              return prevMessages.map((msg, index) => 
                index === existingMessageIndex 
                  ? { 
                      ...msg, 
                      content: data.message,
                      fileName: data.fileName || msg.fileName,
                      fileSize: data.fileSize || msg.fileSize,
                      fileType: data.fileType || msg.fileType,
                      originalSize: data.originalSize || msg.originalSize
                    }
                  : msg
              );
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

            return [...prevMessages, newMessage];
          });
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
  }, [socket, selectedContact, setMessages]);

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 200;
    const menuHeight = 200;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }
    
    setContextMenu({
      show: true,
      position: { x, y },
      message
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, position: { x: 0, y: 0 }, message: null });
  };

  const handleReply = (message) => {
    if (onReply && message) {
      onReply(message);
      setTimeout(() => {
        const messageInput = document.querySelector('.message-input');
        if (messageInput) {
          messageInput.focus();
        }
      }, 100);
    }
  };

  const handleShowInfo = (message) => {
    if (message) {
      setSelectedMessage(message);
      setShowMessageInfo(true);
    }
  };

  const isMessageRead = (message) => {
    if (message.sender === currentUserEmail) {
      if (!lastReadMessageId.current) return false;
      
      const messageIndex = messages.findIndex(msg => msg.id === message.id);
      const lastReadIndex = messages.findIndex(msg => msg.id === lastReadMessageId.current);
      
      return lastReadIndex >= messageIndex;
    }
    return true;
  };

  const getUnreadCount = () => {
    if (firstUnreadIndex === -1) return 0;
    return messages.slice(firstUnreadIndex).filter(msg => msg.sender !== currentUserEmail).length;
  };

  const findReplyToMessage = (replyToId) => {
    return messages.find(msg => msg.id === replyToId);
  };

  const renderReactions = (message) => {
    const reactions = messageReactions[message.id];
    
    if (!reactions || Object.keys(reactions).length === 0) return null;

    const reactionElements = Object.entries(reactions).map(([emoji, users], index) => {
      if (!users || users.length === 0) return null;

      const isOwn = users.includes(user.displayName || user.email);
      const count = users.length;
      const formatUserName = (userIdentifier) => {
        if (userIdentifier === (user.displayName || user.email)) {
          return 'You';
        }
        
        const contact = contacts?.find(c => c.email === userIdentifier);
        if (contact) {
          return contact.name;
        }
        
        if (userIdentifier === selectedContact?.email) {
          return selectedContact.name;
        }
        
        return userIdentifier;
      };

      const tooltipText = count === 1 
        ? `${formatUserName(users[0])} reacted with ${emoji}`
        : users.length === 2
          ? `${users.map(formatUserName).join(' and ')} reacted with ${emoji}`
          : `${users.slice(0, -1).map(formatUserName).join(', ')} and ${formatUserName(users[users.length - 1])} reacted with ${emoji}`;

      return (
        <div 
          key={`${emoji}-${index}`}
          className={`message-reaction ${isOwn ? 'own-reaction' : 'other-reaction'} ${isDark ? 'dark-theme' : 'light-theme'}`}
          onClick={() => isOwn && handleReactionClick(message, emoji)}
          title={tooltipText}
          style={{ cursor: isOwn ? 'pointer' : 'default' }}
        >
          <span className="reaction-emoji">{emoji}</span>
          {count > 1 && <span className="reaction-count">{count}</span>}
        </div>
      );
    }).filter(Boolean);

    if (reactionElements.length === 0) return null;

    return (
      <div className="message-reactions-container">
        {reactionElements}
      </div>
    );
  };

  const handleReactionClick = async (message, emoji) => {
    if (!message || !emoji || !selectedContact || !user) return;

    const currentReactions = messageReactions[message.id] || {};
    const users = currentReactions[emoji] || [];
    const userName = user.displayName || user.email;
    
    if (!users.includes(userName)) return;

    const newUsers = users.filter(u => u !== userName);
    const newReactions = { ...currentReactions };
    
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newUsers;
    }

    setMessageReactions(prev => ({
      ...prev,
      [message.id]: newReactions
    }));

    try {
      const messageData = {
        messageId: message.id,
        emoji: emoji,
        userName: userName,
        remove: true
      };

      await chunkedMessageService.addReactionToMessage(selectedContact.roomID, messageData);

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: message.id,
          reactions: newReactions,
          userName: userName
        });
      }

    } catch (error) {
      console.error('Error removing emoji reaction:', error);
      setMessageReactions(prev => ({
        ...prev,
        [message.id]: currentReactions
      }));
    }
  };

  const renderMessageContent = (message) => {
    if (message.type === 'image') {
      return (
        <div className="image-message-container">
          <img src={message.content} alt="Shared" className="shared-image" />
          <div className="image-actions">
            <button 
              className="image-action-btn preview-btn"
              onClick={() => previewImage(message.content, message.fileName)}
              title="Preview image"
            >
              <FiEye />
            </button>
            <button 
              className="image-action-btn download-btn"
              onClick={() => downloadImage(message)}
              title="Download image"
            >
              <FiDownload />
            </button>
          </div>
        </div>
      );
    } else if (message.type === 'document') {
      const displaySize = message.fileSize || message.originalSize;
      return (
        <div className="document-message">
          <div className="document-info">
            <FiFile className="document-icon" />
            <div className="document-details">
              <span className="document-name">{message.fileName || 'Document'}</span>
              <span className="document-size">
                {displaySize ? `${(displaySize / 1024).toFixed(1)}KB` : 'Unknown size'}
              </span>
            </div>
          </div>
          <button 
            className="download-button"
            onClick={() => downloadDocument(message)}
            title="Download document"
          >
            <FiDownload />
          </button>
        </div>
      );
    } else {
      return <p>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
    }
  };

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
              <span className="unread-text">{getUnreadCount()} unread messages</span>
              <div className="unread-line"></div>
            </div>
          )}
          <div
            className={`message ${message.sender === currentUserEmail ? 'sent' : 'received'} ${message.isSending ? 'sending' : ''} ${message.hasError ? 'error' : ''}`}
            data-message-id={message.id}
          >
            <div 
              className={`message-content ${message.type === 'image' ? 'image-message' : ''} ${message.type === 'document' ? 'document-message-container' : ''} ${copiedMessageId === message.id ? 'copied-flash' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, message)}
            >
              {message.replyTo && (
                <ReplyMessageDisplay 
                  replyTo={findReplyToMessage(message.replyTo) || { 
                    id: message.replyTo, 
                    content: 'Message not found', 
                    sender: 'Unknown' 
                  }} 
                  currentUserEmail={currentUserEmail}
                />
              )}
              {renderMessageContent(message)}
              <div className="message-meta">
                <span className="message-time">{message.time}</span>
                <MessageStatusIndicator 
                  message={{
                    ...message,
                    isRead: isMessageRead(message)
                  }}
                  currentUser={user}
                  selectedContact={selectedContact}
                />
              </div>
              {renderReactions(message)}
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
        show={contextMenu.show}
        position={contextMenu.position}
        message={contextMenu.message}
        onClose={handleCloseContextMenu}
        onReply={handleReply}
        onShowInfo={handleShowInfo}
        onCopy={() => {}}
        onEmojiReact={() => {}}
        isDark={isDark}
        selectedContact={selectedContact}
        user={user}
        messageReactions={messageReactions}
        setMessageReactions={setMessageReactions}
        setCopiedMessageId={setCopiedMessageId}
      />
      
      <MessageInfoModal
        show={showMessageInfo}
        message={selectedMessage}
        onClose={() => {
          setShowMessageInfo(false);
          setSelectedMessage(null);
        }}
        currentUser={user}
      />
    </div>
  );
};