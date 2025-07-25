import React from 'react';
import { UserPlus, Mail, Hash, MessageCircle } from 'lucide-react';

export const NoContactsScreen = ({ onAddFriend }) => {
  return (
    <div className="no-contacts-screen">
      <div className="no-contacts-content">
        <div className="no-contacts-illustration">
          <MessageCircle size={120} className="illustration-icon" />
        </div>
        
        <div className="no-contacts-header">
          <h2 className="no-contacts-title">No Friends Yet</h2>
          <p className="no-contacts-subtitle">Start building your network by adding friends</p>
        </div>

        <div className="add-friends-guide">
          <h3>How to add friends:</h3>
          <div className="guide-steps">
            <div className="guide-step">
              <Mail size={24} className="step-icon" />
              <div className="step-content">
                <h4>By Email</h4>
                <p>Enter your friend's email address</p>
              </div>
            </div>
            
            <div className="guide-step">
              <Hash size={24} className="step-icon" />
              <div className="step-content">
                <h4>By Friend Code</h4>
                <p>Use their unique friend code</p>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onAddFriend} className="add-first-friend-button">
          <UserPlus size={20} />
          Add Your First Friend
        </button>

        <div className="no-contacts-tip">
          <p>💡 Tip: You can find your friend code in the friends menu (top right)</p>
        </div>
      </div>
    </div>
  );
};