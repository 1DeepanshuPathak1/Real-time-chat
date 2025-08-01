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
  const menuRef = useRef(null);
  const plusButtonRef = useRef(null);

  const quickEmojis = ['❤️', '😂', '😮', '😢', '😡'];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        const emojiPicker = document.querySelector('.context-emoji-picker');
        if (!emojiPicker || !emojiPicker.contains(event.target)) {
          onClose();
          setShowEmojiPicker(false);
        }
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [show, onClose]);

  useEffect(() => {
    if (!show) {
      setShowEmojiPicker(false);
    }
  }, [show]);

  const calculateEmojiPickerPosition = () => {
    if (!plusButtonRef.current) return;

    const buttonRect = plusButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const pickerWidth = 320;
    const pickerHeight = 400;
    const margin = 10;
    
    let pickerX = buttonRect.right + margin;
    let pickerY = buttonRect.top - margin;
    
    // Check if picker goes off right edge
    if (pickerX + pickerWidth > viewportWidth - margin) {
      // Position to the left of the button
      pickerX = buttonRect.left - pickerWidth - margin;
      
      // If still off-screen, position relative to viewport
      if (pickerX < margin) {
        pickerX = viewportWidth - pickerWidth - margin;
      }
    }
    
    // Check if picker goes off bottom edge
    if (pickerY + pickerHeight > viewportHeight - margin) {
      // Position above the button
      pickerY = buttonRect.bottom - pickerHeight + margin;
      
      // If still doesn't fit, position from bottom of viewport
      if (pickerY < margin) {
        pickerY = viewportHeight - pickerHeight - margin;
      }
    }
    
    // Ensure picker doesn't go above viewport
    if (pickerY < margin) {
      pickerY = margin;
    }
    
    // Ensure picker doesn't go left of viewport
    if (pickerX < margin) {
      pickerX = margin;
    }
    
    setEmojiPickerPosition({ x: pickerX, y: pickerY });
  };

  if (!show) return null;

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
    if (!showEmojiPicker) {
      calculateEmojiPickerPosition();
    }
    setShowEmojiPicker(!showEmojiPicker);
  };

  return (
    <>
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
              ref={plusButtonRef}
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