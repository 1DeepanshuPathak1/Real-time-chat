import { useRef, useEffect } from 'react';
import { FiSend, FiMic, FiSmile, FiPaperclip, FiImage, FiCamera, FiFile } from 'react-icons/fi';
import './css/MessageInput.css'; 

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
  const attachMenuRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (inputRef.current) {
      window.focusMessageInput = () => {
        inputRef.current.focus();
      };
    }
    
    return () => {
      if (window.focusMessageInput) {
        delete window.focusMessageInput;
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAttachMenu && attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    };

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAttachMenu, setShowAttachMenu]);

  const hasText = inputMessage && inputMessage.trim().length > 0;

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
        <div ref={attachMenuRef} className="attach-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => {
            fileInputRef.current?.click();
            setShowAttachMenu(false);
          }}>
            <FiImage />
            <span>Photos & videos</span>
          </button>
          <button onClick={() => {
            startCamera();
            setShowAttachMenu(false);
          }}>
            <FiCamera />
            <span>Camera</span>
          </button>
          <button onClick={() => {
            documentInputRef.current?.click();
            setShowAttachMenu(false);
          }}>
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
      {!hasText ? (
        <button
          type="button"
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={() => setIsRecording(!isRecording)}
        >
          <FiMic />
        </button>
      ) : (
        <button type="submit" className="send-button">
          <FiSend />
        </button>
      )}
    </form>
  );
};