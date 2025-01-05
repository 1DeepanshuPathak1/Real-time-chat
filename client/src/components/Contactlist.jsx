import React from 'react';

export const ContactList = ({ contacts, selectedContact, onContactClick }) => {
  return (
    <div className="contact-list">
      <div className="contact-list-header">
        <h1>Chats</h1>
      </div>
      <div className="contact-list-scroll">
        {Object.entries(contacts).map(([key, contact]) => (
          <div
            key={key}
            className={`contact-item ${selectedContact?.roomID === contact.roomID ? 'selected' : ''}`}
            onClick={() => onContactClick(contact)}
          >
            <img
              src={`https://api.dicebear.com/6.x/initials/svg?seed=${contact.name}`}
              alt={contact.name}
              className="contact-avatar"
            />
            <div className="contact-info">
              <div className="contact-name-time">
                <h2>{contact.name}</h2>
              </div>
            </div>
            {contact.unreadCount > 0 && (
              <div className="unread-count">{contact.unreadCount}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};