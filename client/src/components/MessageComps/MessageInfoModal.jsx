import { FiX, FiCheck, FiCheckCircle, FiClock, FiFile } from 'react-icons/fi';
import './css/MessageInfoModal.css';

import { useState, useEffect } from 'react';

export const MessageInfoModal = ({ show, message, onClose, currentUser }) => {
  const [previousScroll, setPreviousScroll] = useState(0);
  const isImage = message?.type === 'image';

  useEffect(() => {
    if (show && message) {
      const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
      const inputContainer = document.querySelector('.message-input-container');
      const chatContainer = document.querySelector('.messages-scroll');
      
      if (messageElement && inputContainer) {
        const messageRect = messageElement.getBoundingClientRect();
        const inputHeight = inputContainer.offsetHeight;
        
        document.documentElement.style.setProperty('--top-offset', `${messageRect.bottom}px`);
        document.documentElement.style.setProperty('--input-height', `${inputHeight}px`);
      }
    }
  }, [show, message]);

  if (!show || !message) return null;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusIcon = () => {
    if (message.isRead) {
      return <FiCheckCircle className="status-icon read" />;
    } else if (message.isDelivered) {
      return <FiCheck className="status-icon delivered" />;
    } else {
      return <FiClock className="status-icon sent" />;
    }
  };

  const getStatusText = () => {
    if (message.isRead) return 'Read';
    if (message.isDelivered) return 'Delivered';
    return 'Sent';
  };

  const getMessagePreview = () => {
    if (message.type === 'document') {
      return (
        <div className="document-preview">
          <FiFile className="doc-icon" />
          <div className="doc-info">
            <span className="doc-name">{message.fileName}</span>
            <span className="document-size">
              {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)}KB` : 
               message.originalSize ? `${(message.originalSize / 1024).toFixed(1)}KB` : 'Unknown size'}
            </span>
          </div>
        </div>
      );
    } else if (message.type === 'image') {
      return (
        <div className="image-preview-container">
          <div className="image-thumbnail">
            <img src={message.content} alt="Shared" className="preview-image" />
          </div>
          <div className="image-details">
            <span className="image-name">{message.fileName || 'Image'}</span>
            {(message.fileSize || message.originalSize) && (
              <span className="image-size">
                {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)}KB` : 
                 message.originalSize ? `${(message.originalSize / 1024).toFixed(1)}KB` : ''}
              </span>
            )}
          </div>
        </div>
      );
    } else {
      return <p className="text-preview">{message.content}</p>;
    }
  };

  return (
    <div className="message-info-overlay" onClick={onClose}>
      <div className={`message-info-modal ${message?.type === 'image' || message?.type === 'document' ? 'has-image' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Message Info</h3>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="modal-content">
          {getMessagePreview()}
          
          <div className="message-details">
            <div className="detail-row">
              <span className="detail-label">From:</span>
              <span className="detail-value">{message.sender}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Sent:</span>
              <span className="detail-value">{formatTime(message.timestamp)}</span>
            </div>
            
            {message.sender === currentUser?.email && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <div className="status-container">
                    {getStatusIcon()}
                    <span className="detail-value">{getStatusText()}</span>
                  </div>
                </div>
                
                {message.deliveredAt && (
                  <div className="detail-row">
                    <span className="detail-label">Delivered:</span>
                    <span className="detail-value">{formatTime(message.deliveredAt)}</span>
                  </div>
                )}
                
                {message.readAt && (
                  <div className="detail-row">
                    <span className="detail-label">Read:</span>
                    <span className="detail-value">{formatTime(message.readAt)}</span>
                  </div>
                )}
              </>
            )}
            
            {message.type !== 'text' && (
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{message.type}</span>
              </div>
            )}
            
            {message.fileName && (
              <div className="detail-row">
                <span className="detail-label">File:</span>
                <span className="detail-value">{message.fileName}</span>
              </div>
            )}

            {(message.fileSize || message.originalSize) && (
              <div className="detail-row">
                <span className="detail-label">Size:</span>
                <span className="detail-value">
                  {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)}KB` : 
                   message.originalSize ? `${(message.originalSize / 1024).toFixed(1)}KB` : 'Unknown'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};