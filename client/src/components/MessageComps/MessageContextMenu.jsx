import React, { useState, useRef, useEffect } from 'react';
import { FiCornerUpLeft, FiInfo, FiCopy, FiPlus } from 'react-icons/fi';
import { EmojiPickerComponent } from './EmojiPicker';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import chunkedMessageService from '../../services/chunkedMessageService';
import './css/MessageContextMenu.css';

const db = getFirestore();

export const MessageContextMenu = ({ 
  show, 
  position, 
  message, 
  onClose, 
  onReply, 
  onShowInfo, 
  onCopy, 
  onEmojiReact,
  isDark,
  selectedContact,
  user,
  messageReactions,
  setMessageReactions,
  setCopiedMessageId
}) => {
  const { socket } = useSocket();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });
  const [rightClickPosition, setRightClickPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const quickEmojis = ['❤️', '😂', '😮', '😢', '😡'];

  useEffect(() => {
    if (show) {
      setRightClickPosition({ x: position.x, y: position.y });
    }
  }, [show, position]);

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
      
      if (show && menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, showEmojiPicker, onClose]);

  useEffect(() => {
    if (!show) {
      setShowEmojiPicker(false);
    }
  }, [show]);

  const calculateEmojiPickerPosition = () => {
    const pickerWidth = 350;
    let x = rightClickPosition.x;
    let y = rightClickPosition.y + 130;
    
    if (x + pickerWidth > window.innerWidth) {
      x = rightClickPosition.x - pickerWidth + 90;
    }
    
    setEmojiPickerPosition({ x, y });
  };

  const handleReply = () => {
    onReply(message);
    onClose();
  };

  const handleShowInfo = () => {
    onShowInfo(message);
    onClose();
  };

  const handleCopy = async () => {
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
    onClose();
  };

  const handleEmojiReact = async (targetMessage, emoji) => {
    console.log('handleEmojiReact called with:', { targetMessage, emoji, selectedContact, user });
    
    if (!targetMessage || !emoji || !selectedContact || !user) {
      console.log('Missing required data for emoji reaction');
      return;
    }

    const currentReaction = messageReactions[targetMessage.id];
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

    console.log('Setting new reaction:', newReaction);

    setMessageReactions(prev => ({
      ...prev,
      [targetMessage.id]: newReaction
    }));

    try {
      const messageData = {
        messageId: targetMessage.id,
        emoji: emoji,
        userId: user.uid,
        userEmail: user.email,
        timestamp: Date.now()
      };

      await chunkedMessageService.addReactionToMessage(selectedContact.roomID, messageData);

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: targetMessage.id,
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
        [targetMessage.id]: currentReaction
      }));
    }
  };

  const handleQuickEmoji = (emoji) => {
    handleEmojiReact(message, emoji);
    onClose();
  };

  const handleEmojiClick = (emojiObject) => {
    console.log('Emoji clicked:', emojiObject);
    if (emojiObject && emojiObject.emoji && message) {
      handleEmojiReact(message, emojiObject.emoji);
    }
    setShowEmojiPicker(false);
    onClose();
  };

  const handlePlusClick = (e) => {
    e.stopPropagation();
    calculateEmojiPickerPosition();
    setShowEmojiPicker(true);
  };

  if (!show && !showEmojiPicker) return null;

  return (
    <>
      {show && !showEmojiPicker && (
        <div
          ref={menuRef}
          className="message-context-menu"
          style={{
            left: position.x,
            top: position.y,
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
          style={{
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
    </>
  );
};