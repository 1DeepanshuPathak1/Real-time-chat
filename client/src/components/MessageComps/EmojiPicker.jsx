import EmojiPicker from 'emoji-picker-react';

export const EmojiPickerComponent = ({ onEmojiClick, show, theme }) => {
  if (!show) return null;

  return (
    <div className="emoji-picker-container">
      <EmojiPicker onEmojiClick={onEmojiClick} theme={theme} />
    </div>
  );
};