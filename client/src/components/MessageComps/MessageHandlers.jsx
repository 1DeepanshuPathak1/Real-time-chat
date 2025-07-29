import { useState } from 'react';
import chunkedMessageService from '../../services/chunkedMessageService';

export const useMessageHandlers = (setMessages, socket, selectedContact, user) => {
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async (inputMessage, setInputMessage) => {
    if (!inputMessage.trim() || !selectedContact || !user || isSending) return;

    setIsSending(true);
    const messageContent = inputMessage.trim();
    setInputMessage('');

    try {
      const messageData = {
        sender: user.email,
        content: messageContent,
        type: 'text'
      };

      const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      const newMessage = {
        id: messageId,
        sender: user.email,
        content: messageContent,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: 'text'
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: messageContent,
          sender: user.email,
          messageId: messageId,
          timestamp: newMessage.timestamp
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setInputMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (file, type) => {
    if (!file || !selectedContact || !user || isSending) return;

    setIsSending(true);

    try {
      const messageData = {
        sender: user.email,
        content: file.name,
        type: type,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };

      const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      const newMessage = {
        id: messageId,
        sender: user.email,
        content: URL.createObjectURL(file),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        type: type,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isDelivered: false,
        isRead: false
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: file.name,
          sender: user.email,
          messageId: messageId,
          type: type,
          fileName: file.name,
          timestamp: newMessage.timestamp
        });
      }

    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsSending(false);
    }
  };

  return { handleSendMessage, handleFileUpload };
};