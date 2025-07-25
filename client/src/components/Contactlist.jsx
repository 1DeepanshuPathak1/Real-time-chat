import React, { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, Users, Bell } from 'lucide-react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { FriendRequestHandler } from './FriendRequestHandler';
import './css/ContactList.css';

export const ContactList = ({ contacts, selectedContact, onContactClick, user }) => {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [requestStatus, setRequestStatus] = useState({ message: '', type: '' });
  const [userCode, setUserCode] = useState('LOADING...');

  const db = getFirestore();

  useEffect(() => {
    const fetchUserCode = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserCode(userData.userCode || 'NO CODE');
          }
        } catch (error) {
          console.error('Error fetching user code:', error);
          setUserCode('ERROR');
        }
      }
    };

    fetchUserCode();
  }, [user, db]);

  const {
    showRequests,
    setShowRequests,
    sendFriendRequest,
    loading,
    FriendRequestsModal,
    FriendRequestBadge
  } = FriendRequestHandler({ user });

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (friendEmail.trim()) {
      const result = await sendFriendRequest(friendEmail);
      setRequestStatus({
        message: result.message,
        type: result.success ? 'success' : 'error'
      });
      
      if (result.success) {
        setFriendEmail('');
        setShowAddFriend(false);
      }
      
      setTimeout(() => setRequestStatus({ message: '', type: '' }), 3000);
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
            className="friend-requests-button"
            onClick={() => setShowRequests(!showRequests)}
          >
            <Bell size={20} />
            <FriendRequestBadge />
          </button>
          <button 
            className="add-friend-button"
            onClick={() => setShowAddFriend(!showAddFriend)}
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {requestStatus.message && (
        <div className={`status-message ${requestStatus.type}`}>
          {requestStatus.message}
        </div>
      )}

      {showAddFriend && (
        <div className="add-friend-modal">
          <form onSubmit={handleAddFriend}>
            <input
              type="text"
              placeholder="Enter friend's email or code"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              className="friend-input"
              disabled={loading}
            />
            <div className="modal-buttons">
              <button type="submit" className="send-request-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send Request'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddFriend(false)}
                className="cancel-button"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <FriendRequestsModal />

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