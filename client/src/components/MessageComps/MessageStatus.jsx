import React, { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import './css/MessageStatus.css';

const db = getFirestore();

export const MessageStatusIndicator = ({ message, currentUser, selectedContact }) => {
  const [status, setStatus] = useState('sent');
  const { socket } = useSocket();
  const isOwn = message.sender === currentUser?.email;

  if (!isOwn) return null;

  useEffect(() => {
    if (!message || !selectedContact || !currentUser) return;

    let contactStatusUnsubscribe = null;
    let messageStatusUnsubscribe = null;

    const initializeMessageStatus = async () => {
      try {
        const messageStatusRef = doc(db, 'messageStatus', `${selectedContact.roomID}_${message.id}`);
        
        messageStatusUnsubscribe = onSnapshot(messageStatusRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const statusData = docSnapshot.data();
            if (statusData.isRead) {
              setStatus('read');
              return;
            }
            if (statusData.isDelivered) {
              setStatus('delivered');
              return;
            }
          }
          
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', selectedContact.email));
          getDocs(q).then(querySnapshot => {
            if (!querySnapshot.empty) {
              const contactDoc = querySnapshot.docs[0];
              
              contactStatusUnsubscribe = onSnapshot(doc(db, 'users', contactDoc.id), (userSnapshot) => {
                if (userSnapshot.exists()) {
                  const contactData = userSnapshot.data();
                  
                  if (contactData.isOnline && contactData.lastSeenTimestamp > new Date(message.timestamp).getTime()) {
                    setDoc(messageStatusRef, {
                      messageId: message.id,
                      roomId: selectedContact.roomID,
                      isDelivered: true,
                      deliveredAt: new Date().toISOString()
                    }, { merge: true });
                    setStatus('delivered');
                  }
                }
              });
            }
          });
        });

      } catch (error) {
        console.error('Error initializing message status:', error);
      }
    };

    initializeMessageStatus();

    return () => {
      if (contactStatusUnsubscribe) contactStatusUnsubscribe();
      if (messageStatusUnsubscribe) messageStatusUnsubscribe();
    };
  }, [message, selectedContact, currentUser]);

  useEffect(() => {
    if (socket && selectedContact && message) {
      const handleMessageRead = async (data) => {
        if (data.roomId === selectedContact.roomID && data.messageIds.includes(message.id)) {
          const messageStatusRef = doc(db, 'messageStatus', `${selectedContact.roomID}_${message.id}`);
          await setDoc(messageStatusRef, {
            messageId: message.id,
            roomId: selectedContact.roomID,
            isDelivered: true,
            isRead: true,
            readAt: new Date().toISOString()
          }, { merge: true });
          setStatus('read');
        }
      };

      socket.on('message-read', handleMessageRead);
      return () => socket.off('message-read', handleMessageRead);
    }
  }, [socket, message, selectedContact]);

  const getStatusClass = () => {
    switch (status) {
      case 'sent': return 'status-sent';
      case 'delivered': return 'status-delivered';  
      case 'read': return 'status-read';
      default: return 'status-sent';
    }
  };

  return (
    <div className={`message-status-indicator ${getStatusClass()}`}>
      <div className="status-dot"></div>
      <div className="status-pulse"></div>
    </div>
  );
};

export const UnreadMessageCounter = ({ count = 0, className = '' }) => {
  if (!count || count === 0) return null;

  return (
    <div className={`unread-counter ${className}`}>
      <span className="unread-count">{count > 99 ? '99+' : count}</span>
      <div className="unread-glow"></div>
    </div>
  );
};