import React, { useEffect, useRef, useState } from 'react';
import { FiFile } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageInfoModal } from './MessageInfoModal';
import { ReplyMessageDisplay } from './ReplyMessage';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import chunkedMessageService from '../../services/chunkedMessageService';
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
    const fetchMessageReactions = () => {
      if (!messages.length) return;
      
      const reactions = {};
      messages.forEach(message => {
        if (message.em || message.e) {
          reactions[message.id] = message.em || message.e;
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
            [data.messageId]: data.reaction
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

    const currentReaction = messageReactions[message.id];
    let newReaction = null;

    if (currentReaction && currentReaction.emoji === emoji && currentReaction.userId === user.uid) {
      newReaction = null;
    } else {
      newReaction = {
        emoji: emoji,
        userId: user.uid,
        userEmail: user.email,
        timestamp: Date.now()
      };
    }

    setMessageReactions(prev => ({
      ...prev,
      [message.id]: newReaction
    }));

    try {
      const messageData = {
        messageId: message.id,
        emoji: emoji,
        userId: user.uid,
        userEmail: user.email,
        timestamp: Date.now()
      };

      await chunkedMessageService.addReactionToMessage(selectedContact.roomID, messageData);

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: message.id,
          reaction: newReaction,
          userId: user.uid,
          userEmail: user.email,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Error handling emoji reaction:', error);
      setMessageReactions(prev => ({
        ...prev,
        [message.id]: currentReaction
      }));
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

  const renderReaction = (message) => {
    const reaction = messageReactions[message.id];
    
    if (!reaction) return null;

    const isOwn = reaction.userId === user.uid;

    return (
      <div 
        className={`message-reaction ${isOwn ? 'own-reaction' : 'other-reaction'}`}
        onClick={() => handleEmojiReact(message, reaction.emoji)}
        title={`${isOwn ? 'You' : reaction.userEmail} reacted with ${reaction.emoji}`}
      >
        <span className="reaction-emoji">{reaction.emoji}</span>
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
              {renderReaction(message)}
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