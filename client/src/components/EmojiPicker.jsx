import React from 'react';
import EmojiPicker from 'emoji-picker-react';

export const EmojiPickerComponent = ({ onEmojiClick, show }) => {
  if (!show) return null;
  
  return (
    <div className="emoji-picker-container">
      <EmojiPicker onEmojiClick={onEmojiClick} />
    </div>
  );
};