import React, { useRef, useEffect } from 'react';
import { FiSend, FiMic, FiSmile, FiPaperclip, FiImage, FiCamera, FiFile, FiBarChart2 } from 'react-icons/fi';

export const MessageInput = ({
  onSubmit,
  inputMessage,
  setInputMessage,
  isRecording,
  setIsRecording,
  showEmojiPicker,
  setShowEmojiPicker,
  showAttachMenu,
  setShowAttachMenu,
  fileInputRef,
  documentInputRef,
  startCamera,
  autoFocus = false
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <form onSubmit={onSubmit} className="message-input-container">
      <button
        type="button"
        className="emoji-button"
        onClick={(e) => {
          e.stopPropagation();
          setShowEmojiPicker(!showEmojiPicker);
          setShowAttachMenu(false);
        }}
      >
        <FiSmile />
      </button>
      <button
        type="button"
        className="attach-button"
        onClick={(e) => {
          e.stopPropagation();
          setShowAttachMenu(!showAttachMenu);
          setShowEmojiPicker(false);
        }}
      >
        <FiPaperclip />
      </button>
      {showAttachMenu && (
        <div className="attach-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => fileInputRef.current?.click()}>
            <FiImage />
            <span>Photos & videos</span>
          </button>
          <button onClick={startCamera}>
            <FiCamera />
            <span>Camera</span>
          </button>
          <button onClick={() => documentInputRef.current?.click()}>
            <FiFile />
            <span>Document</span>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder="Type a message"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        className="message-input"
      />
      <button
        type="button"
        className={`mic-button ${isRecording ? 'recording' : ''}`}
        onClick={() => setIsRecording(!isRecording)}
      >
        <FiMic />
      </button>
      <button type="submit" className="send-button">
        <FiSend />
      </button>
    </form>
  );
};