import React from 'react';
import { FiFile } from 'react-icons/fi';

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick, currentUserEmail }) => {
  return (
    <div className="messages-scroll">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.sender === currentUserEmail ? 'sent' : 'received'}`}
        >
          <div className={`message-content ${message.type === 'image' ? 'image-message' : ''}`}>
            {message.type === 'image' ? (
              <img src={message.content} alt="Shared" className="shared-image" />
            ) : message.type === 'document' ? (
              <div
                className="document-message cursor-pointer hover:bg-gray-100"
                onClick={() => handleDocumentClick(message.fileUrl)}
              >
                <FiFile className="document-icon" />
                <span>{message.fileName || message.content}</span>
              </div>
            ) : (
              <p>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</p>
            )}
            <span className="message-time">{message.time}</span>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};