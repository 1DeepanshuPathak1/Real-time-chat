import React, { useState, useRef, useEffect } from 'react';
import { FiCornerUpLeft, FiInfo, FiCopy, FiPlus } from 'react-icons/fi';
import { EmojiPickerComponent } from './EmojiPicker';
import './css/MessageContextMenu.css';

export const MessageContextMenu = ({ 
  show, 
  position, 
  message, 
  onClose, 
  onReply, 
  onShowInfo, 
  onCopy, 
  onEmojiReact,
  isDark 
}) => {
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
        const emojiPicker = document.querySelector('.context-emoji-picker');
        if (!emojiPicker || !emojiPicker.contains(event.target)) {
          setShowEmojiPicker(false);
        }
      } else if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (show || showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
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
      x = rightClickPosition.x - pickerWidth+90;
    }
    
    setEmojiPickerPosition({ x, y });
  };

  if (!show && !showEmojiPicker) return null;

  const handleReply = () => {
    onReply(message);
    onClose();
  };

  const handleShowInfo = () => {
    onShowInfo(message);
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      onCopy();
    } catch (err) {
      console.error('Failed to copy text');
    }
    onClose();
  };

  const handleQuickEmoji = (emoji) => {
    onEmojiReact(message, emoji);
    onClose();
  };

  const handleEmojiClick = (emojiObject) => {
    onEmojiReact(message, emojiObject.emoji);
    setShowEmojiPicker(false);
    onClose();
  };

  const handlePlusClick = (e) => {
    e.stopPropagation();
    calculateEmojiPickerPosition();
    setShowEmojiPicker(true);
  };

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