import React from 'react';
import { MessageCircle, Users, Zap, Shield } from 'lucide-react';

export const WelcomeScreen = () => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <div className="welcome-logo">
            <MessageCircle size={64} className="logo-icon" />
          </div>
          <h1 className="welcome-title">Welcome to ChatApp</h1>
          <p className="welcome-subtitle">Connect with friends and family instantly</p>
        </div>

        <div className="welcome-features">
          <div className="feature-card">
            <Users size={32} className="feature-icon" />
            <h3>Stay Connected</h3>
            <p>Chat with friends and make new connections easily</p>
          </div>
          
          <div className="feature-card">
            <Zap size={32} className="feature-icon" />
            <h3>Real-time Messaging</h3>
            <p>Send messages, images, and polls instantly</p>
          </div>
          
          <div className="feature-card">
            <Shield size={32} className="feature-icon" />
            <h3>Secure & Private</h3>
            <p>Your conversations are protected and encrypted</p>
          </div>
        </div>

        <div className="welcome-action">
          <p className="action-text">Select a conversation to start chatting</p>
        </div>
      </div>
    </div>
  );
};