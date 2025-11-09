import { useState, useRef, useEffect } from 'react';
import { FiCornerUpLeft, FiInfo, FiCopy, FiPlus } from 'react-icons/fi';
import { EmojiPickerComponent } from './EmojiPicker';
import { MessageInfoModal } from './MessageInfoModal';
import chunkedMessageService from '../../services/chunkedMessageService';
import './css/MessageContextMenu.css';

export const MessageContextMenu = ({ 
  messages,
  selectedContact,
  user,
  messageReactions,
  setMessageReactions,
  contacts,
  isDark,
  onReply,
  socket
}) => {
  const [contextMenu, setContextMenu] = useState({ show: false, position: { x: 0, y: 0 }, message: null });
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const [rightClickPosition, setRightClickPosition] = useState({ x: 0, y: 0 });
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const menuRef = useRef(null);

  const quickEmojis = ['❤️', '😂', '😮', '😢', '😡'];

  const isMobile = () => {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker) {
        const contextEmojiPicker = document.querySelector('.context-emoji-picker');
        const emojiPickerReact = document.querySelector('.EmojiPickerReact');
        
        if (contextEmojiPicker && emojiPickerReact) {
          if (!contextEmojiPicker.contains(event.target) && !emojiPickerReact.contains(event.target)) {
            setShowEmojiPicker(false);
          }
        }
        return;
      }
      
      if (contextMenu.show && menuRef.current && !menuRef.current.contains(event.target)) {
        handleCloseContextMenu();
      }
      if (showMessageInfo && !event.target.closest('.message-info-modal')) {
        setShowMessageInfo(false);
        setSelectedMessage(null);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        handleCloseContextMenu();
        setShowMessageInfo(false);
        setSelectedMessage(null);
      }
    };

    const handleContextMenu = (e) => {
      if (isMobile()) return;
      
      const messageElement = e.target.closest('.message-content') || e.target.closest('.shared-image');
      if (messageElement) {
        e.preventDefault();
        e.stopPropagation();
        
        const messageId = messageElement.closest('.message').getAttribute('data-message-id');
        const message = messages.find(msg => msg.id === messageId);
        
        if (message) {
          const rect = messageElement.getBoundingClientRect();
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
          setRightClickPosition({ x: e.clientX, y: e.clientY });
        }
      }
    };

    const handleTouchStart = (e) => {
      if (!isMobile()) return;
      
      const messageElement = e.target.closest('.message-content');
      if (messageElement) {
        const messageRect = messageElement.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const positionClass = messageRect.bottom > windowHeight / 2 ? 'above-message' : 'below-message';
        const menuPosition = messageRect.bottom > windowHeight / 2 ? 
          `${windowHeight - messageRect.top + 10}px` : 
          `${messageRect.bottom + 10}px`;

        setLongPressTimer(
          setTimeout(() => {
            setContextMenu({
              show: true,
              position: {
                menuPosition,
                positionClass
              },
              message: messages.find(m => m.id === messageElement.closest('.message').getAttribute('data-message-id'))
            });
            setLongPressMessage(messageElement);
          }, 500)
        );
      }
    };

    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      
      if (longPressMessage) {
        setTimeout(() => {
          longPressMessage.classList.remove('message-long-press');
          setLongPressMessage(null);
        }, 300);
      }
    };

    const handleTouchMove = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [contextMenu.show, showMessageInfo, showEmojiPicker, messages, longPressTimer]);

  useEffect(() => {
    if (!contextMenu.show) {
      setShowEmojiPicker(false);
    }
  }, [contextMenu.show]);

  const calculateEmojiPickerPosition = () => {
    if (isMobile()) {
      return;
    }
    
    const pickerWidth = 350;
    let x = rightClickPosition.x;
    let y = rightClickPosition.y + 130;
    
    if (x + pickerWidth > window.innerWidth) {
      x = rightClickPosition.x - pickerWidth + 90;
    }
    
    setEmojiPickerPosition({ x, y });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, position: { x: 0, y: 0 }, message: null });
  };

  const handleReply = () => {
    if (onReply && contextMenu.message) {
      onReply(contextMenu.message);
      setTimeout(() => {
        const messageInput = document.querySelector('.message-input');
        if (messageInput) {
          messageInput.focus();
        }
      }, 100);
    }
    handleCloseContextMenu();
  };

  const handleShowInfo = () => {
    if (contextMenu.message) {
      setSelectedMessage(contextMenu.message);
      setShowMessageInfo(true);
    }
    handleCloseContextMenu();
  };

  const handleCopy = async () => {
    if (!contextMenu.message || !contextMenu.message.content) return;

    try {
      let textToCopy = '';
      
      if (contextMenu.message.type === 'text') {
        textToCopy = contextMenu.message.content;
      } else if (contextMenu.message.type === 'document' || contextMenu.message.type === 'image') {
        textToCopy = contextMenu.message.fileName || contextMenu.message.content;
      } else {
        textToCopy = contextMenu.message.content.toString();
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

      setCopiedMessageId(contextMenu.message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);

    } catch (error) {
      console.error('Failed to copy message:', error);
    }
    handleCloseContextMenu();
  };

  const handleEmojiReact = async (targetMessage, emoji) => {
    if (!targetMessage || !emoji || !selectedContact || !user) {
      return;
    }

    const currentReactions = messageReactions[targetMessage.id] || {};
    let newReactions = { ...currentReactions };

    let userReacted = false;
    for (const [reactionEmoji, users] of Object.entries(currentReactions)) {
      if (users.includes(user.displayName || user.email)) {
        if (reactionEmoji === emoji) {
          newReactions[reactionEmoji] = users.filter(u => u !== (user.displayName || user.email));
          if (newReactions[reactionEmoji].length === 0) {
            delete newReactions[reactionEmoji];
          }
          userReacted = true;
        } else {
          newReactions[reactionEmoji] = users.filter(u => u !== (user.displayName || user.email));
          if (newReactions[reactionEmoji].length === 0) {
            delete newReactions[reactionEmoji];
          }
        }
        break;
      }
    }

    if (!userReacted) {
      if (newReactions[emoji]) {
        if (!newReactions[emoji].includes(user.displayName || user.email)) {
          newReactions[emoji].push(user.displayName || user.email);
        }
      } else {
        newReactions[emoji] = [user.displayName || user.email];
      }

      if (Object.keys(newReactions).length > 2) {
        const reactionKeys = Object.keys(newReactions);
        const oldestReaction = reactionKeys[0];
        delete newReactions[oldestReaction];
      }
    }

    setMessageReactions(prev => ({
      ...prev,
      [targetMessage.id]: newReactions
    }));

    try {
      const messageData = {
        messageId: targetMessage.id,
        emoji: emoji,
        userName: user.displayName || user.email,
        remove: userReacted
      };

      await chunkedMessageService.addReactionToMessage(selectedContact.roomID, messageData);

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: targetMessage.id,
          reactions: newReactions,
          userName: user.displayName || user.email
        });
      }

    } catch (error) {
      console.error('Error handling emoji reaction:', error);
      setMessageReactions(prev => ({
        ...prev,
        [targetMessage.id]: currentReactions
      }));
    }
  };

  const handleQuickEmoji = (emoji) => {
    handleEmojiReact(contextMenu.message, emoji);
    handleCloseContextMenu();
  };

  const handleEmojiClick = (emojiObject) => {
    if (emojiObject && emojiObject.emoji && contextMenu.message) {
      handleEmojiReact(contextMenu.message, emojiObject.emoji);
    }
    setShowEmojiPicker(false);
    handleCloseContextMenu();
  };

  const handlePlusClick = (e) => {
    e.stopPropagation();
    if (!isMobile()) {
      calculateEmojiPickerPosition();
    }
    setShowEmojiPicker(true);
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

  useEffect(() => {
    const handleReactionClicks = (e) => {
      const reactionElement = e.target.closest('.message-reaction.own-reaction');
      if (reactionElement) {
        const messageElement = reactionElement.closest('.message');
        const messageId = messageElement.getAttribute('data-message-id');
        const message = messages.find(msg => msg.id === messageId);
        const emoji = reactionElement.querySelector('.reaction-emoji').textContent;
        
        if (message && emoji) {
          handleReactionClick(message, emoji);
        }
      }
    };

    document.addEventListener('click', handleReactionClicks);
    return () => document.removeEventListener('click', handleReactionClicks);
  }, [messages, messageReactions, selectedContact, user, socket]);

  useEffect(() => {
    const messageElements = document.querySelectorAll('.message-content');
    messageElements.forEach(element => {
      const messageId = element.closest('.message').getAttribute('data-message-id');
      if (copiedMessageId === messageId) {
        element.classList.add('copied-flash');
        setTimeout(() => {
          element.classList.remove('copied-flash');
        }, 2000);
      }
    });
  }, [copiedMessageId]);

  return (
    <>
      {contextMenu.show && !showEmojiPicker && (
        <div
          ref={menuRef}
          className={`message-context-menu ${contextMenu.position?.positionClass || ''}`}
          style={isMobile() ? {
            '--menu-position': contextMenu.position?.menuPosition
          } : {
            left: contextMenu.position?.x,
            top: contextMenu.position?.y,
          }}
        >
          <div className="context-menu-content">
            <div className="quick-reactions">
              {quickEmojis.map((emoji, index) => (
                <button
                  key={index}
                  className="quick-emoji-btn"
                  onClick={() => handleQuickEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
              <button
                className="plus-emoji-btn"
                onClick={handlePlusClick}
              >
                <FiPlus />
              </button>
            </div>
            
            <div className="context-menu-divider"></div>
            
            <button className="context-menu-item" onClick={handleReply}>
              <FiCornerUpLeft className="context-menu-icon" />
              <span>Reply</span>
            </button>
            
            <button className="context-menu-item" onClick={handleShowInfo}>
              <FiInfo className="context-menu-icon" />
              <span>Info</span>
            </button>
            
            <button className="context-menu-item" onClick={handleCopy}>
              <FiCopy className="context-menu-icon" />
              <span>Copy</span>
            </button>
          </div>
        </div>
      )}
      
      {showEmojiPicker && (
        <div 
          className="context-emoji-picker" 
          style={isMobile() ? {} : {
            position: 'fixed',
            left: emojiPickerPosition.x,
            top: emojiPickerPosition.y,
            zIndex: 1002
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiPickerComponent
            theme={isDark ? 'dark' : 'light'}
            show={true}
            onEmojiClick={handleEmojiClick}
          />
        </div>
      )}
      
      {showMessageInfo && (
        <MessageInfoModal
          show={showMessageInfo}
          message={selectedMessage}
          onClose={() => {
            setShowMessageInfo(false);
            setSelectedMessage(null);
          }}
          currentUser={user}
        />
      )}
    </>
  );
};