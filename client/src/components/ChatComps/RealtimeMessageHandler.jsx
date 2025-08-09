import { useEffect } from 'react';

export const useRealtimeMessageHandler = (onMessageReceived, selectedContact, setMessages, moveContactToTop, setContacts) => {
  useEffect(() => {
    const unsubscribeMessage = onMessageReceived(async (data) => {
      console.log('Received real-time message:', data);

      if (selectedContact && data.roomID === selectedContact.roomID) {
        const newMessage = {
          id: data.messageId || Date.now(),
          sender: data.sender,
          content: data.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: data.timestamp || Date.now(),
          type: data.type || 'text',
          fileName: data.fileName,
          replyTo: data.replyTo
        };

        setMessages(prevMessages => {
          const exists = prevMessages.find(msg => msg.id === newMessage.id);
          if (exists) return prevMessages;
          return [...prevMessages, newMessage];
        });
      } else {
        moveContactToTop(data.roomID);

        setContacts(prevContacts =>
          prevContacts.map(contact =>
            contact.roomID === data.roomID
              ? {
                ...contact,
                unreadCount: (contact.unreadCount || 0) + 1,
                lastMessageTime: Date.now()
              }
              : contact
          )
        );
      }
    });

    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
    };
  }, [onMessageReceived, selectedContact, moveContactToTop]);
};