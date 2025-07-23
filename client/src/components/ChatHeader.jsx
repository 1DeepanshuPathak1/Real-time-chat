import React, { useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

export const ChatHeader = ({ selectedContact, onThemeChange }) => {
  const [isDark, setIsDark] = useState(true);

  const handleThemeChange = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    onThemeChange(newTheme);

    const root = document.documentElement;
    if (newTheme) {
      root.style.setProperty('--bg-color', '#040404');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--secondary-bg', '#242527');
      root.style.setProperty('--border-color', '#1f5953');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#000000');
      root.style.setProperty('--secondary-bg', '#f0f2f5');
      root.style.setProperty('--border-color', '#e0e0e0');
    }
  };

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
      <button
        onClick={handleThemeChange}
        className={`theme-toggle-button ${isDark ? 'dark' : 'light'}`}
      >
        <span className={`theme-icon ${isDark ? 'dark' : 'light'}`}>
          {isDark ? <FaMoon size={18} /> : <FaSun size={18} />}
        </span>
        <span className={`theme-text ${isDark ? 'dark' : 'light'}`}>{isDark ? 'Dark' : 'Light'} Mode</span>
      </button>
    </div>
  );
};