import React, { useState, useEffect } from 'react';
import { useSocket } from '../../services/SocketService';
import './css/MessageStatus.css';

const userStatusCache = new Map();

export const MessageStatusIndicator = ({ message, currentUser, selectedContact }) => {
  const [status, setStatus] = useState('sent');
  const { socket } = useSocket();
  const isOwn = message.sender === currentUser?.email;

  if (!isOwn) return null;

  useEffect(() => {
    if (!message || !selectedContact || !currentUser) return;

    const checkMessageStatus = () => {
      try {
        if (message.isRead) {
          setStatus('read');
          return;
        }
        
        if (message.isDelivered) {
          setStatus('delivered');
          return;
        }

        const contactEmail = selectedContact.email;
        const contactStatus = userStatusCache.get(contactEmail);
        
        if (contactStatus && contactStatus.isOnline) {
          const messageTimestamp = new Date(message.timestamp).getTime();
          
          if (contactStatus.lastSeenTimestamp > messageTimestamp) {
            setStatus('delivered');
          }
        }

      } catch (error) {
        console.error('Error checking message status:', error);
        setStatus('sent');
      }
    };

    checkMessageStatus();
    const interval = setInterval(checkMessageStatus, 5000);
    return () => clearInterval(interval);
  }, [message, selectedContact, currentUser]);

  useEffect(() => {
    if (socket && selectedContact && message) {
      const handleMessageRead = (data) => {
        if (data.roomId === selectedContact.roomID && data.messageIds.includes(message.id)) {
          setStatus('read');
        }
      };

      socket.on('message-read', handleMessageRead);
      return () => socket.off('message-read', handleMessageRead);
    }
  }, [socket, message, selectedContact]);

  const getStatusClass = () => {
    switch (status) {
      case 'sent': return 'status-sent';
      case 'delivered': return 'status-delivered';  
      case 'read': return 'status-read';
      default: return 'status-sent';
    }
  };

  return (
    <div className={`message-status-indicator ${getStatusClass()}`}>
      <div className="status-dot"></div>
      <div className="status-pulse"></div>
    </div>
  );
};

export const UnreadMessageCounter = ({ count = 0, className = '' }) => {
  if (!count || count === 0) return null;

  return (
    <div className={`unread-counter ${className}`}>
      <span className="unread-count">{count > 99 ? '99+' : count}</span>
      <div className="unread-glow"></div>
    </div>
  );
};