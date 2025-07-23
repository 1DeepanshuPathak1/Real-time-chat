import React from 'react';
import { FiFile } from 'react-icons/fi';

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick }) => {
  return (
    <div className="messages-scroll">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.sender === 'You' ? 'sent' : 'received'}`}
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
                <span>{message.fileName}</span>
              </div>
            ) : message.type === 'poll' ? (
              <div className="poll-message">
                <h4>{message.content.question}</h4>
                <ul>
                  {message.content.options.map((option, index) => (
                    <li key={index}>{option}</li>
                  ))}
                </ul>
                <p>{message.content.allowMultiple ? 'Multiple choice' : 'Single choice'}</p>
              </div>
            ) : (
              <p>{message.content}</p>
            )}
            <span className="message-time">{message.time}</span>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};