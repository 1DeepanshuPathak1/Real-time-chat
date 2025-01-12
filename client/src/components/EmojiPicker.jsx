import React from 'react';
import EmojiPicker from 'emoji-picker-react';

export const EmojiPickerComponent = ({ onEmojiClick, show, theme }) => {
  if (!show) return null;
  
  return (
    <div className="emoji-picker-container ${theme}">
      <EmojiPicker onEmojiClick={onEmojiClick} theme={theme} />
    </div>
  );
};