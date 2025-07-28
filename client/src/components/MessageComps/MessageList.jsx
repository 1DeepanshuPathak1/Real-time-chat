import React, { useEffect, useRef } from 'react';
import { FiFile } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { getFirestore, doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';

const db = getFirestore();

const userStatusCache = new Map();

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick, currentUserEmail, selectedContact, user, firstUnreadIndex }) => {
  const { socket } = useSocket();
  const lastReadTimestamp = useRef(0);

  useEffect(() => {
    const updateUserActiveStatus = () => {
      if (!user || !selectedContact) return;

      const cacheKey = user.email;
      userStatusCache.set(cacheKey, {
        activeRoom: selectedContact.roomID,
        isInChat: true,
        lastSeenTimestamp: Date.now()
      });
    };

    const clearUserActiveStatus = () => {
      if (!user) return;

      const cacheKey = user.email;
      userStatusCache.set(cacheKey, {
        activeRoom: null,
        isInChat: false,
        lastSeenTimestamp: Date.now()
      });
    };

    updateUserActiveStatus();

    return () => {
      clearUserActiveStatus();
    };
  }, [user, selectedContact]);

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !selectedContact || messages.length === 0) return;

      const visibleMessages = messages.filter(msg => 
        msg.sender !== currentUserEmail && 
        !msg.isRead &&
        new Date(msg.timestamp).getTime() > lastReadTimestamp.current
      );

      if (visibleMessages.length === 0) return;

      const messageIds = visibleMessages.map(msg => msg.id);
      const latestTimestamp = Math.max(...visibleMessages.map(msg => new Date(msg.timestamp).getTime()));
      
      try {
        for (const message of visibleMessages) {
          const messageRef = doc(db, 'rooms', selectedContact.roomID, 'messages', message.id);
          await updateDoc(messageRef, {
            isDelivered: true,
            isRead: true,
            readAt: new Date().toISOString(),
            readBy: user.email
          });
        }

        const roomRef = doc(db, 'rooms', selectedContact.roomID);
        await updateDoc(roomRef, {
          [`lastReadBy_${user.uid}`]: latestTimestamp
        });

        if (socket) {
          socket.emit('mark-messages-read', {
            roomId: selectedContact.roomID,
            messageIds: messageIds,
            userId: user.uid,
            userEmail: user.email,
            readTimestamp: latestTimestamp
          });
        }

        lastReadTimestamp.current = latestTimestamp;

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    const timeoutId = setTimeout(markMessagesAsRead, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, user, selectedContact, socket, currentUserEmail]);

  const getUnreadCount = () => {
    if (firstUnreadIndex === -1) return 0;
    return messages.slice(firstUnreadIndex).filter(msg => msg.sender !== currentUserEmail).length;
  };

  return (
    <div className="messages-scroll">
      {messages.map((message, index) => (
        <div key={message.id}>
          {index === firstUnreadIndex && firstUnreadIndex !== -1 && (
            <div className="unread-messages-divider">
              <div className="unread-line"></div>
              <span className="unread-text">{getUnreadCount()} unread messages</span>
              <div className="unread-line"></div>
            </div>
          )}
          <div
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
              <div className="message-meta">
                <span className="message-time">{message.time}</span>
                <MessageStatusIndicator 
                  message={message}
                  currentUser={user}
                  selectedContact={selectedContact}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};