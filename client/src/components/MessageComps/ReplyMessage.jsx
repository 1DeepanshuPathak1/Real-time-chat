import { FiX } from 'react-icons/fi';
import './css/ReplyMessage.css';

export const ReplyMessage = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  const truncateText = (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="reply-message-container">
      <div className="reply-indicator"></div>
      <div className="reply-content">
        <div className="reply-header">
          <span className="reply-to-name">{replyTo.sender}</span>
          <button className="cancel-reply-button" onClick={onCancel}>
            <FiX />
          </button>
        </div>
        <div className="reply-text">
          {truncateText(replyTo.content)}
        </div>
      </div>
    </div>
  );
};

export const scrollToMessage = (messageId) => {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    messageElement.classList.add('message-highlight');
    setTimeout(() => {
      messageElement.classList.remove('message-highlight');
    }, 2000);
  }
};

export const findReplyToMessage = (messages, replyToId) => {
  return messages.find(msg => msg.id === replyToId);
};

export const ReplyMessageDisplay = ({ replyTo, currentUserEmail, messages }) => {
  if (!replyTo) return null;

  const truncateText = (text, maxLength = 40) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleReplyClick = () => {
    if (replyTo.id) {
      scrollToMessage(replyTo.id);
    }
  };

  return (
    <div className="replied-message-display" onClick={handleReplyClick} style={{ cursor: 'pointer' }}>
      <div className="reply-indicator-small"></div>
      <div className="replied-content">
        <div className="replied-to-name">
          {replyTo.sender === currentUserEmail ? 'You' : replyTo.sender}
        </div>
        <div className="replied-text">
          {truncateText(replyTo.content)}
        </div>
      </div>
    </div>
  );
};