import React, { useState } from 'react';
import { UserPlus, Copy, Check, Users } from 'lucide-react';
import './css/ContactList.css';

export const ContactList = ({ contacts, selectedContact, onContactClick, user }) => {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const userCode = user?.uid?.slice(-6).toUpperCase() || 'USER123';

  const handleAddFriend = (e) => {
    e.preventDefault();
    if (friendEmail.trim()) {
      // TODO: Implement friend request logic
      console.log('Sending friend request to:', friendEmail);
      setFriendEmail('');
      setShowAddFriend(false);
    }
  };

  const copyUserCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="contact-list">
      <div className="contact-list-header">
        <h1>Chats</h1>
        <div className="header-actions">
          <div className="user-code">
            <span>Your Code: {userCode}</span>
            <button onClick={copyUserCode} className="copy-button">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button 
            className="add-friend-button"
            onClick={() => setShowAddFriend(!showAddFriend)}
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {showAddFriend && (
        <div className="add-friend-modal">
          <form onSubmit={handleAddFriend}>
            <input
              type="email"
              placeholder="Enter friend's email or code"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              className="friend-input"
            />
            <div className="modal-buttons">
              <button type="submit" className="send-request-button">
                Send Request
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddFriend(false)}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="contact-list-scroll">
        {contacts.length === 0 ? (
          <div className="no-contacts">
            <div className="no-contacts-animation">
              <Users size={80} className="floating-icons" />
            </div>
            <h3>No friends yet!</h3>
            <p>Share your code <strong>{userCode}</strong> with friends or add them using their email/code.</p>
            <button 
              className="add-first-friend"
              onClick={() => setShowAddFriend(true)}
            >
              <UserPlus size={20} />
              Add Your First Friend
            </button>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
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
          ))
        )}
      </div>
    </div>
  );
};