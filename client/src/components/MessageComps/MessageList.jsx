import React, { useEffect, useRef, useState } from 'react';
import { FiFile } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageInfoModal } from './MessageInfoModal';
import { ReplyMessageDisplay } from './ReplyMessage';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import './css/MessageReactions.css';

const db = getFirestore();

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick, currentUserEmail, selectedContact, user, firstUnreadIndex, showStartMessage, isDark, onReply }) => {
  const { socket } = useSocket();
  const lastReadMessageId = useRef(null);
  const hasScrolledToUnread = useRef(false);
  const [contextMenu, setContextMenu] = useState({ show: false, position: { x: 0, y: 0 }, message: null });
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [messageReactions, setMessageReactions] = useState({});

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
    const fetchMessageReactions = async () => {
      if (!selectedContact || !messages.length) return;
      
      try {
        const reactions = {};
        for (const message of messages) {
          const messageRef = doc(db, 'rooms', selectedContact.roomID, 'messages', message.id);
          const messageDoc = await getDoc(messageRef);
          if (messageDoc.exists() && messageDoc.data().reactions) {
            reactions[message.id] = messageDoc.data().reactions;
          }
        }
        setMessageReactions(reactions);
      } catch (error) {
        console.error('Error fetching message reactions:', error);
      }
    };

    fetchMessageReactions();
  }, [selectedContact, messages]);

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
      if (contextMenu.show && !event.target.closest('.message-context-menu')) {
        handleCloseContextMenu();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        handleCloseContextMenu();
        setShowMessageInfo(false);
      }
    };

    if (contextMenu.show || showMessageInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [contextMenu.show, showMessageInfo]);

  useEffect(() => {
    if (socket) {
      const handleReactionUpdate = (data) => {
        if (data.roomId === selectedContact?.roomID) {
          setMessageReactions(prev => ({
            ...prev,
            [data.messageId]: data.reactions
          }));
        }
      };

      socket.on('reaction-updated', handleReactionUpdate);
      return () => socket.off('reaction-updated', handleReactionUpdate);
    }
  }, [socket, selectedContact]);

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

  const handleCopy = async (message) => {
    if (!message || !message.content) return;

    try {
      let textToCopy = '';
      
      if (message.type === 'text') {
        textToCopy = message.content;
      } else if (message.type === 'document' || message.type === 'image') {
        textToCopy = message.fileName || message.content;
      } else {
        textToCopy = message.content.toString();
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
          throw new Error('Copy failed');
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);

    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleEmojiReact = async (message, emoji) => {
    if (!message || !emoji || !selectedContact || !user) return;

    try {
      const roomRef = doc(db, 'rooms', selectedContact.roomID);
      const messageRef = doc(roomRef, 'messages', message.id);
      
      const messageDoc = await getDoc(messageRef);
      let currentReactions = {};
      
      if (messageDoc.exists()) {
        currentReactions = messageDoc.data().reactions || {};
      } else {
        await updateDoc(messageRef, {
          id: message.id,
          sender: message.sender,
          content: message.content,
          timestamp: message.timestamp,
          type: message.type || 'text',
          reactions: {}
        });
      }

      const userReactions = currentReactions[user.uid] || [];
      const existingReactionIndex = userReactions.findIndex(r => r.emoji === emoji);
      
      if (existingReactionIndex !== -1) {
        userReactions.splice(existingReactionIndex, 1);
      } else {
        userReactions.push({ emoji, timestamp: Date.now() });
      }
      
      const updatedReactions = {
        ...currentReactions,
        [user.uid]: userReactions.length > 0 ? userReactions : undefined
      };

      Object.keys(updatedReactions).forEach(key => {
        if (updatedReactions[key] === undefined) {
          delete updatedReactions[key];
        }
      });
      
      await updateDoc(messageRef, { reactions: updatedReactions });
      
      setMessageReactions(prev => ({
        ...prev,
        [message.id]: updatedReactions
      }));

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: message.id,
          reactions: updatedReactions,
          userId: user.uid,
          userEmail: user.email
        });
      }

    } catch (error) {
      console.error('Error handling emoji reaction:', error);
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
    const reactions = messageReactions[message.id] || {};
    const reactionCounts = {};
    
    Object.values(reactions).forEach(userReactions => {
      if (Array.isArray(userReactions)) {
        userReactions.forEach(reaction => {
          if (reactionCounts[reaction.emoji]) {
            reactionCounts[reaction.emoji]++;
          } else {
            reactionCounts[reaction.emoji] = 1;
          }
        });
      }
    });

    if (Object.keys(reactionCounts).length === 0) return null;

    return (
      <div className="message-reactions">
        {Object.entries(reactionCounts).map(([emoji, count]) => (
          <div 
            key={emoji} 
            className="reaction-bubble"
            onClick={() => handleEmojiReact(message, emoji)}
          >
            <span className="reaction-emoji">{emoji}</span>
            {count > 1 && <span className="reaction-count">{count}</span>}
          </div>
        ))}
      </div>
    );
  };

  const renderMessageContent = (message) => {
    if (message.type === 'image') {
      return <img src={message.content} alt="Shared" className="shared-image" />;
    } else if (message.type === 'document') {
      return (
        <div
          className="document-message cursor-pointer hover:bg-gray-100"
          onClick={() => handleDocumentClick(message.fileUrl || message.content)}
        >
          <FiFile className="document-icon" />
          <span>{message.fileName || message.content}</span>
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
            className={`message ${message.sender === currentUserEmail ? 'sent' : 'received'}`}
            data-message-id={message.id}
          >
            <div 
              className={`message-content ${message.type === 'image' ? 'image-message' : ''} ${copiedMessageId === message.id ? 'copied-flash' : ''}`}
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
      
      <MessageContextMenu
        show={contextMenu.show}
        position={contextMenu.position}
        message={contextMenu.message}
        onClose={handleCloseContextMenu}
        onReply={handleReply}
        onShowInfo={handleShowInfo}
        onCopy={() => handleCopy(contextMenu.message)}
        onEmojiReact={handleEmojiReact}
        isDark={isDark}
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