import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, Copy, Check, Users, Bell, ChevronUp, ChevronDown } from 'lucide-react';
import { FaSun, FaMoon } from 'react-icons/fa';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { FriendRequestHandler } from './FriendRequestHandler';
import { useContactStatus } from './UserStatusManager';
import './css/ContactList.css';

const ContactItem = ({ contact, selectedContact, onContactClick, handleContactClick }) => {
  const status = useContactStatus(contact);
  
  return (
    <div
      key={contact.id}
      className={`contact-item ${selectedContact?.roomID === contact.roomID ? 'selected' : ''}`}
      onClick={() => handleContactClick(contact)}
    >
      <div className="contact-avatar-container">
        <img
          src={`https://api.dicebear.com/6.x/initials/svg?seed=${contact.name}`}
          alt={contact.name}
          className="contact-avatar"
        />
        {status.isOnline && <div className="online-indicator"></div>}
      </div>
      <div className="contact-info">
        <div className="contact-name-time">
          <h2>{contact.name}</h2>
        </div>
        <div className="contact-status">
          {status.isOnline ? (
            <span className="online-text">Online</span>
          ) : (
            <span className="offline-text">{status.lastSeen}</span>
          )}
        </div>
      </div>
      {contact.unreadCount > 0 && (
        <div className="unread-count">{contact.unreadCount}</div>
      )}
    </div>
  );
};

export const ContactList = ({ contacts, selectedContact, onContactClick, user, onThemeChange, isDark }) => {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [requestStatus, setRequestStatus] = useState({ message: '', type: '' });
  const [userCode, setUserCode] = useState('LOADING...');
  const [showFooter, setShowFooter] = useState(false);
  
  const footerStateRef = useRef(showFooter);
  const db = getFirestore();

  useEffect(() => {
    footerStateRef.current = showFooter;
  }, [showFooter]);

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
  }, [user?.uid, db]);

  const {
    showRequests,
    setShowRequests,
    sendFriendRequest,
    loading,
    FriendRequestsModal,
    FriendRequestBadge
  } = FriendRequestHandler({ user });

  const handleAddFriend = useCallback(async (e) => {
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
  }, [friendEmail, sendFriendRequest]);

  const copyUserCode = useCallback(() => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [userCode]);

  const handleThemeChange = useCallback(() => {
    const newTheme = !isDark;
    onThemeChange(newTheme);

    const root = document.documentElement;
    if (newTheme) {
      root.style.setProperty('--bg-color', '#040404');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--secondary-bg', '#242527');
      root.style.setProperty('--border-color', '#1f5953');
      root.style.setProperty('--accent-color', '#128C7E');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#1e293b');
      root.style.setProperty('--secondary-bg', '#f1f5f9');
      root.style.setProperty('--border-color', '#e2e8f0');
      root.style.setProperty('--accent-color', '#3b82f6');
    }
  }, [isDark, onThemeChange]);

  const handleContactClick = useCallback((contact) => {
    onContactClick(contact);
  }, [onContactClick]);

  const handleFooterToggle = useCallback(() => {
    setShowFooter(prev => !prev);
  }, []);

  return (
    <div className={`contact-list ${isDark ? 'dark' : 'light'}`}>
      <div className="contact-list-header">
        <h1>Chats</h1>
        <div className="header-actions">
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

      <div className={`add-friend-modal ${showAddFriend ? 'show' : ''}`}>
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
            <ContactItem
              key={contact.id}
              contact={contact}
              selectedContact={selectedContact}
              onContactClick={onContactClick}
              handleContactClick={handleContactClick}
            />
          ))
        )}
      </div>

      <div className="contact-list-footer-container">
        <button 
          className={`footer-toggle ${showFooter ? 'open' : ''}`}
          onClick={handleFooterToggle}
        >
          <ChevronUp size={20} />
        </button>
        
        <div className={`contact-list-footer ${showFooter ? 'show' : ''}`}>
          <div className="footer-content">
            <div className="user-code">
              <span>Code : {userCode}</span>
              <button onClick={copyUserCode} className="copy-button">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={handleThemeChange}
              className={`theme-toggle-button ${isDark ? 'dark' : 'light'}`}
              title="Toggle Theme"
            >
              <span className={`theme-icon ${isDark ? 'dark' : 'light'}`}>
                {isDark ? <FaMoon size={18} /> : <FaSun size={18} />}
              </span>
              <span className={`theme-text ${isDark ? 'dark' : 'light'}`}>{isDark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};