import React from 'react';
import './css/ChatHeader.css';

export const ChatHeader = ({ selectedContact, isDark }) => {
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
            {selectedContact.isOnline ? (
              <span className="online-status">
                <span className="status-dot online"></span>
                Online
              </span>
            ) : (
              <span className="offline-status">
                Last seen {selectedContact.lastSeen || 'recently'}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};