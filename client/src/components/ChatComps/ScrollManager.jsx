import { useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';

export const useScrollManager = (selectedContact, user, messages, hasScrolledToUnread, loadingOlderMessages, setHasScrolledToUnread, setFirstUnreadIndex, messagesEndRef, db) => {
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToFirstUnreadMessage = useCallback(async () => {
    if (!selectedContact || !user || messages.length === 0 || hasScrolledToUnread) return;

    try {
      const roomRef = doc(db, 'rooms', selectedContact.roomID);
      const roomDoc = await getDoc(roomRef);
      const lastReadTimestamp = roomDoc.data()?.[`lastReadTimestamp_${user.uid}`] || 0;

      const firstUnreadIdx = messages.findIndex(msg =>
        msg.sender !== user.email &&
        (msg.timestamp > lastReadTimestamp)
      );

      setFirstUnreadIndex(firstUnreadIdx);

      if (firstUnreadIdx !== -1) {
        setTimeout(() => {
          const messageElements = document.querySelectorAll('.message');
          const firstUnreadElement = messageElements[firstUnreadIdx];
          if (firstUnreadElement) {
            firstUnreadElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHasScrolledToUnread(true);
          }
        }, 300);
      } else {
        setTimeout(() => {
          scrollToBottom();
          setHasScrolledToUnread(true);
        }, 300);
      }
    } catch (error) {
      console.error('Error scrolling to first unread:', error);
      setTimeout(() => {
        scrollToBottom();
        setHasScrolledToUnread(true);
      }, 300);
    }
  }, [selectedContact, user, messages, hasScrolledToUnread]);

  useEffect(() => {
    if (messages.length > 0 && !loadingOlderMessages && selectedContact && !hasScrolledToUnread) {
      scrollToFirstUnreadMessage();
    } else if (messages.length > 0 && !loadingOlderMessages && hasScrolledToUnread && messages[messages.length - 1]?.sender === user?.email) {
      scrollToBottom();
    }
  }, [messages, loadingOlderMessages, selectedContact, hasScrolledToUnread, scrollToFirstUnreadMessage, user]);

  return { scrollToBottom };
};