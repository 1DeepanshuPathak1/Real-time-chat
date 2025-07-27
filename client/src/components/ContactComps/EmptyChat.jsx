import React from 'react';
import { MessageCircle, Users, Sparkles } from 'lucide-react';
import '../css/EmptyChat.css';

export const EmptyChat = () => {
  return (
    <div className="empty-chat-container">
      <div className="empty-chat-animation">
        <div className="floating-elements">
          <MessageCircle size={60} className="floating-icon icon-1" />
          <Users size={45} className="floating-icon icon-2" />
          <Sparkles size={35} className="floating-icon icon-3" />
        </div>
        <div className="main-icon">
          <MessageCircle size={120} className="pulse-icon" />
        </div>
      </div>
      <div className="empty-chat-content">
        <h2>Welcome to Chat App</h2>
        <p>Select a contact from the sidebar to start chatting, or add new friends to begin conversations!</p>
        <div className="features-list">
          <div className="feature-item">
            <MessageCircle size={20} />
            <span>Send messages instantly</span>
          </div>
          <div className="feature-item">
            <Users size={20} />
            <span>Share photos and files</span>
          </div>
          <div className="feature-item">
            <Sparkles size={20} />
            <span>Create polls and interact</span>
          </div>
        </div>
      </div>
    </div>
  );
};