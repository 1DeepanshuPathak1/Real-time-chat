import React from 'react';
import { useContactStatus } from './UserStatusManager';
import './css/ChatHeader.css';

export const ChatHeader = ({ selectedContact, isDark }) => {
  const status = useContactStatus(selectedContact);
  
  if (!selectedContact) return null;

  return (
    <div className={`chat-header ${isDark ? 'dark' : 'light'}`}>
      <div className="chat-header-info">
        <img
          src={`https://api.dicebear.com/6.x/initials/svg?seed=${selectedContact.name}`}
          alt={selectedContact.name}
          className="chat-header-avatar"
        />
        <div className="chat-header-details">
          <h2>{selectedContact.name}</h2>
          <span className="status-text">
            {status.isOnline ? (
              <span className="online-status">
                <span className="status-dot online"></span>
                Online
              </span>
            ) : (
              <span className="offline-status">
                {status.lastSeen}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};