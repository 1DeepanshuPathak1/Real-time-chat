import React, { useState, useRef, useEffect } from 'react';
import { FiCornerUpLeft, FiInfo, FiCopy, FiSmile } from 'react-icons/fi';
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
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
        setShowEmojiPicker(false);
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

  const handleEmojiClick = (emojiObject) => {
    onEmojiReact(message, emojiObject.emoji);
    setShowEmojiPicker(false);
    onClose();
  };

  const toggleEmojiPicker = (e) => {
    e.stopPropagation();
    setShowEmojiPicker(!showEmojiPicker);
  };

  return (
    <div
      ref={menuRef}
      className="message-context-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="context-menu-content">
        <button className="context-menu-item" onClick={handleReply}>
          <FiCornerUpLeft className="context-menu-icon" />
          <span>Reply</span>
        </button>
        
        <button className="context-menu-item" onClick={toggleEmojiPicker}>
          <FiSmile className="context-menu-icon" />
          <span>React</span>
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
      
      {showEmojiPicker && (
        <div className="context-emoji-picker" onClick={(e) => e.stopPropagation()}>
          <EmojiPickerComponent
            theme={isDark ? 'dark' : 'light'}
            show={true}
            onEmojiClick={handleEmojiClick}
          />
        </div>
      )}
    </div>
  );
};