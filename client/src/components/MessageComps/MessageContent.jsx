import { FiFile, FiDownload, FiEye } from 'react-icons/fi';
import { downloadDocument, downloadImage } from './MessageUtils';

export const MessageContent = ({ message, onPreviewImage }) => {
  const renderMessageContent = () => {
    if (message.type === 'image') {
      return (
        <div className="image-message-container">
          <img src={message.content} alt="Shared" className="shared-image" />
          <div className="image-actions">
            <button 
              className="image-action-btn preview-btn"
              onClick={() => onPreviewImage(message.content, message.fileName)}
              title="Preview image"
            >
              <FiEye />
            </button>
            <button 
              className="image-action-btn download-btn"
              onClick={() => downloadImage(message)}
              title="Download image"
            >
              <FiDownload />
            </button>
          </div>
        </div>
      );
    } else if (message.type === 'document') {
      const displaySize = message.fileSize || message.originalSize;
      return (
        <div className="document-message">
          <div className="document-info">
            <FiFile className="document-icon" />
            <div className="document-details">
              <span className="document-name">{message.fileName || 'Document'}</span>
              <span className="document-size">
                {displaySize ? `${(displaySize / 1024).toFixed(1)}KB` : 'Unknown size'}
              </span>
            </div>
          </div>
          <button 
            className="download-button"
            onClick={() => downloadDocument(message)}
            title="Download document"
          >
            <FiDownload />
          </button>
        </div>
      );
    } else {
      return <p>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>;
    }
  };

  return renderMessageContent();
};