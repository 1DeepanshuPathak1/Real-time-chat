import React, { useEffect, useRef } from 'react';
import { FiFile } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';

const db = getFirestore();

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick, currentUserEmail, selectedContact, user, firstUnreadIndex, showStartMessage }) => {
  const { socket } = useSocket();
  const lastReadMessageId = useRef(null);
  const hasScrolledToUnread = useRef(false);

  useEffect(() => {
    const fetchLastReadMessageId = async () => {
      if (!user || !selectedContact) return;
      
      try {
        const roomRef = doc(db, 'rooms', selectedContact.roomID);
        const roomDoc = await getDoc(roomRef);
        const roomData = roomDoc.data();
        lastReadMessageId.current = roomData?.[`lastReadMessageId_${user.uid}`] || null;
      } catch (error) {
        console.error('Error fetching last read message ID:', error);
      }
    };

    fetchLastReadMessageId();
  }, [user, selectedContact]);

  useEffect(() => {
    if (messages.length > 0 && selectedContact && !hasScrolledToUnread.current) {
      const scrollToTarget = () => {
        if (firstUnreadIndex !== -1) {
          const messageElements = document.querySelectorAll('.message');
          const firstUnreadElement = messageElements[firstUnreadIndex];
          if (firstUnreadElement) {
            firstUnreadElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        } else {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: 'smooth' 
          });
        }
        hasScrolledToUnread.current = true;
      };

      setTimeout(scrollToTarget, 100);
    }
  }, [messages, firstUnreadIndex, selectedContact, messagesEndRef]);

  useEffect(() => {
    if (selectedContact) {
      hasScrolledToUnread.current = false;
    }
  }, [selectedContact]);

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !selectedContact || messages.length === 0) return;

      const unreadMessages = messages.filter(msg => 
        msg.sender !== currentUserEmail
      );

      if (unreadMessages.length === 0) return;

      const lastUnreadMessage = unreadMessages[unreadMessages.length - 1];
      
      try {
        const roomRef = doc(db, 'rooms', selectedContact.roomID);
        await updateDoc(roomRef, {
          [`lastReadMessageId_${user.uid}`]: lastUnreadMessage.id,
          [`lastReadTimestamp_${user.uid}`]: Date.now()
        });

        lastReadMessageId.current = lastUnreadMessage.id;

        if (socket) {
          socket.emit('mark-messages-read', {
            roomId: selectedContact.roomID,
            lastReadMessageId: lastUnreadMessage.id,
            userId: user.uid,
            userEmail: user.email
          });
        }

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    const timeoutId = setTimeout(markMessagesAsRead, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, user, selectedContact, socket, currentUserEmail]);

  const isMessageRead = (message) => {
    if (message.sender === currentUserEmail) {
      if (!lastReadMessageId.current) return false;
      
      const messageIndex = messages.findIndex(msg => msg.id === message.id);
      const lastReadIndex = messages.findIndex(msg => msg.id === lastReadMessageId.current);
      
      return lastReadIndex >= messageIndex;
    }
    return true;
  };

  const getUnreadCount = () => {
    if (firstUnreadIndex === -1) return 0;
    return messages.slice(firstUnreadIndex).filter(msg => msg.sender !== currentUserEmail).length;
  };

  return (
    <div className="messages-scroll">
      {showStartMessage && (
        <div className="conversation-start">
          <div className="start-message">
            <h3>👋 Say hello to {selectedContact?.name}!</h3>
            <p>This is the beginning of your conversation.</p>
          </div>
        </div>
      )}
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
                  onClick={() => handleDocumentClick(message.fileUrl || message.content)}
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
                  message={{
                    ...message,
                    isRead: isMessageRead(message)
                  }}
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