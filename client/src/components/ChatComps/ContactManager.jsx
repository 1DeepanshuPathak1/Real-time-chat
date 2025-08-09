import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';

export const useContactsManager = (user, db) => {
  const [contacts, setContacts] = useState([]);

  const updateContactUnreadCount = useCallback((roomId, updates) => {
    setContacts(prevContacts =>
      prevContacts.map(contact =>
        contact.roomID === roomId
          ? { ...contact, ...updates }
          : contact
      )
    );
  }, []);

  const moveContactToTop = useCallback((roomId) => {
    setContacts(prevContacts => {
      const contactIndex = prevContacts.findIndex(c => c.roomID === roomId);
      if (contactIndex > 0) {
        const updatedContacts = [...prevContacts];
        const contact = updatedContacts.splice(contactIndex, 1)[0];
        contact.lastMessageTime = Date.now();
        updatedContacts.unshift(contact);
        return updatedContacts;
      }
      return prevContacts;
    });
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const contactsData = await Promise.all(
          snapshot.docs.map(async (contactDoc) => {
            const contactData = { id: contactDoc.id, ...contactDoc.data() };

            try {
              const roomRef = doc(db, 'rooms', contactData.roomID);
              const roomDoc = await getDoc(roomRef);
              const roomData = roomDoc.data();
              const lastMessageTimestamp = roomData?.lastMessageTimestamp || roomData?.lastMessageTime || 0;
              const lastReadTimestamp = roomData?.[`lastReadTimestamp_${user.uid}`] || 0;
              const lastReadMessageId = roomData?.[`lastReadMessageId_${user.uid}`];

              const messagesQuery = query(
                collection(db, 'rooms', contactData.roomID, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(50)
              );
              const messagesSnapshot = await getDocs(messagesQuery);

              let unreadCount = 0;
              if (lastReadMessageId) {
                let foundLastRead = false;
                for (const msgDoc of messagesSnapshot.docs) {
                  const msgData = msgDoc.data();
                  if (msgData.sender !== user.email) {
                    if (msgDoc.id === lastReadMessageId) {
                      foundLastRead = true;
                      break;
                    }
                    if (!foundLastRead) {
                      unreadCount++;
                    }
                  }
                }
              } else {
                unreadCount = messagesSnapshot.docs.filter(doc =>
                  doc.data().sender !== user.email &&
                  doc.data().timestamp > lastReadTimestamp
                ).length;
              }

              return {
                ...contactData,
                unreadCount,
                lastMessageTime: typeof lastMessageTimestamp === 'string'
                  ? new Date(lastMessageTimestamp).getTime()
                  : lastMessageTimestamp
              };
            } catch (error) {
              console.error('Error fetching room data:', error);
              return {
                ...contactData,
                unreadCount: 0,
                lastMessageTime: 0
              };
            }
          })
        );

        const sortedContacts = contactsData.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        setContacts(sortedContacts);
      });

      return () => unsubscribe();
    }
  }, [user]);

  return { contacts, updateContactUnreadCount, moveContactToTop };
};