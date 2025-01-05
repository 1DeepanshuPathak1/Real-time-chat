import React from 'react';

export const ChatHeader = ({ selectedContact }) => {
  if (!selectedContact) return null;

  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <img
          src={`https://api.dicebear.com/6.x/initials/svg?seed=${selectedContact.name}`}
          alt={selectedContact.name}
          className="chat-header-avatar"
        />
        <h2>{selectedContact.name}</h2>
      </div>
    </div>
  );
};