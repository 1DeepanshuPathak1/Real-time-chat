import { useState } from 'react';
import chunkedMessageService from '../../services/chunkedMessageService';

export const useMessageHandlers = (setMessages, socket, selectedContact, user) => {
  const [isSending, setIsSending] = useState(false);

  const compressFile = async (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        const maxSize = 800;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const processDocument = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        resolve(`data:${file.type};base64,${base64String}`);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSendMessage = async (inputMessage, setInputMessage, replyTo = null) => {
    if (!inputMessage.trim() || !selectedContact || !user || isSending) return;

    setIsSending(true);
    const messageContent = inputMessage.trim();
    setInputMessage('');

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Date.now();
    
    const newMessage = {
      id: tempId,
      sender: user.email,
      content: messageContent,
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp,
      type: 'text',
      isDelivered: false,
      isRead: false,
      isSending: true,
      ...(replyTo && { replyTo: replyTo.id })
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);

    try {
      const messageData = {
        sender: user.email,
        content: messageContent,
        type: 'text',
        ...(replyTo && { replyTo: replyTo.id })
      };

      const actualMessageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: actualMessageId, isSending: false, isDelivered: true }
            : msg
        )
      );

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: messageContent,
          sender: user.email,
          messageId: actualMessageId,
          timestamp: timestamp,
          type: 'text',
          ...(replyTo && { replyTo: replyTo.id })
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, isSending: false, isDelivered: false, hasError: true }
            : msg
        )
      );
      setInputMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (file, type) => {
    if (!file || !selectedContact || !user || isSending) return;

    if (type === 'document' && file.size > 3 * 1024 * 1024) {
      alert('Document files must be smaller than 3MB.');
      return;
    }

    setIsSending(true);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Date.now();

    try {
      let processedContent;
      let originalSize = file.size;
      let finalSize = originalSize;
      
      if (type === 'image') {
        processedContent = await compressFile(file);
        finalSize = new Blob([processedContent]).size;
      } else if (type === 'document') {
        processedContent = await processDocument(file);
        finalSize = originalSize;
      }

      const tempMessage = {
        id: tempId,
        sender: user.email,
        content: processedContent,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: timestamp,
        type: type,
        fileName: file.name,
        fileSize: finalSize,
        fileType: file.type,
        originalSize: originalSize,
        isDelivered: false,
        isRead: false,
        isSending: true
      };

      setMessages(prevMessages => [...prevMessages, tempMessage]);

      const messageData = {
        sender: user.email,
        content: processedContent,
        type: type,
        fileName: file.name,
        fileSize: finalSize,
        fileType: file.type,
        originalSize: originalSize
      };

      const actualMessageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: actualMessageId, isSending: false, isDelivered: true }
            : msg
        )
      );

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: processedContent,
          sender: user.email,
          messageId: actualMessageId,
          type: type,
          fileName: file.name,
          timestamp: timestamp,
          fileSize: finalSize,
          originalSize: originalSize,
          fileType: file.type
        });
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, isSending: false, isDelivered: false, hasError: true }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  return { handleSendMessage, handleFileUpload };
};