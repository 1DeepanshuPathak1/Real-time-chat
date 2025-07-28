import React, { useEffect, useRef } from 'react';
import { FiFile } from 'react-icons/fi';
import { MessageStatusIndicator } from './MessageStatus';
import { getFirestore, doc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';

const db = getFirestore();

export const MessageList = ({ messages, messagesEndRef, handleDocumentClick, currentUserEmail, selectedContact, user }) => {
  const { socket } = useSocket();
  const lastReadTimestamp = useRef(0);

  useEffect(() => {
    const updateUserActiveStatus = async () => {
      if (!user || !selectedContact) return;

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            activeRoom: selectedContact.roomID,
            isInChat: true,
            lastSeenTimestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error updating user active status:', error);
      }
    };

    const clearUserActiveStatus = async () => {
      if (!user) return;

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            activeRoom: null,
            isInChat: false
          });
        }
      } catch (error) {
        console.error('Error clearing user active status:', error);
      }
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
        new Date(msg.timestamp).getTime() > lastReadTimestamp.current
      );

      if (visibleMessages.length === 0) return;

      const messageIds = visibleMessages.map(msg => msg.id);
      const latestTimestamp = Math.max(...visibleMessages.map(msg => new Date(msg.timestamp).getTime()));
      
      try {
        for (const message of visibleMessages) {
          const messageStatusRef = doc(db, 'messageStatus', `${selectedContact.roomID}_${message.id}`);
          await setDoc(messageStatusRef, {
            messageId: message.id,
            roomId: selectedContact.roomID,
            isDelivered: true,
            isRead: true,
            readAt: new Date().toISOString(),
            readBy: user.email
          }, { merge: true });
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            [`lastReadIn_${selectedContact.roomID}`]: latestTimestamp
          });
        }

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

    const timeoutId = setTimeout(markMessagesAsRead, 500);
    return () => clearTimeout(timeoutId);
  }, [messages, user, selectedContact, socket, currentUserEmail]);

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
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};