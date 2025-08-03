import { FiX, FiCheck, FiCheckCircle, FiClock } from 'react-icons/fi';
import './css/MessageInfoModal.css';

export const MessageInfoModal = ({ show, message, onClose, currentUser }) => {
  if (!show || !message) return null;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusIcon = () => {
    if (message.isRead) {
      return <FiCheckCircle className="status-icon read" />;
    } else if (message.isDelivered) {
      return <FiCheck className="status-icon delivered" />;
    } else {
      return <FiClock className="status-icon sent" />;
    }
  };

  const getStatusText = () => {
    if (message.isRead) return 'Read';
    if (message.isDelivered) return 'Delivered';
    return 'Sent';
  };

  return (
    <div className="message-info-overlay" onClick={onClose}>
      <div className="message-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Message Info</h3>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="modal-content">
          <div className="message-preview">
            <p>{message.content}</p>
          </div>
          
          <div className="message-details">
            <div className="detail-row">
              <span className="detail-label">From:</span>
              <span className="detail-value">{message.sender}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Sent:</span>
              <span className="detail-value">{formatTime(message.timestamp)}</span>
            </div>
            
            {message.sender === currentUser?.email && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <div className="status-container">
                    {getStatusIcon()}
                    <span className="detail-value">{getStatusText()}</span>
                  </div>
                </div>
                
                {message.deliveredAt && (
                  <div className="detail-row">
                    <span className="detail-label">Delivered:</span>
                    <span className="detail-value">{formatTime(message.deliveredAt)}</span>
                  </div>
                )}
                
                {message.readAt && (
                  <div className="detail-row">
                    <span className="detail-label">Read:</span>
                    <span className="detail-value">{formatTime(message.readAt)}</span>
                  </div>
                )}
              </>
            )}
            
            {message.type !== 'text' && (
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{message.type}</span>
              </div>
            )}
            
            {message.fileName && (
              <div className="detail-row">
                <span className="detail-label">File:</span>
                <span className="detail-value">{message.fileName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};