import React from 'react';
import { createMessage } from '../services/messageServices';

export const useMessageHandlers = (setMessages, socket, selectedContact) => {
  const handleSendMessage = (inputMessage, setInputMessage) => {
    if (inputMessage.trim() && selectedContact) {
      const newMessage = createMessage(inputMessage.trim());
      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');

      if (socket) {
        socket.emit('send-message', {
          roomId: selectedContact.roomID,
          message: inputMessage.trim()
        });
      }
    }
  };

  const handleFileUpload = (file, type) => {
    if (file) {
      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newMessage = createMessage(e.target.result, 'image');
          setMessages(prev => [...prev, newMessage]);
        };
        reader.readAsDataURL(file);
      } else if (type === 'document') {
        const newMessage = createMessage(`📄 ${file.name}`, 'document', file);
        setMessages(prev => [...prev, newMessage]);
      }
    }
  };

  return { handleSendMessage, handleFileUpload };
};
