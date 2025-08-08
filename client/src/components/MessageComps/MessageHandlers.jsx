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

  const compressDocument = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = String.fromCharCode.apply(null, uint8Array);
        const base64String = btoa(binaryString);
        
        const compressed = compressLZW(base64String);
        resolve(compressed);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const compressLZW = (data) => {
    const dict = {};
    let dictSize = 256;
    const result = [];
    let w = '';
    
    for (let i = 0; i < 256; i++) {
      dict[String.fromCharCode(i)] = i;
    }
    
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const wc = w + c;
      
      if (dict.hasOwnProperty(wc)) {
        w = wc;
      } else {
        result.push(dict[w]);
        dict[wc] = dictSize++;
        w = c;
      }
    }
    
    if (w !== '') {
      result.push(dict[w]);
    }
    
    const compressed = result.map(code => String.fromCharCode(code)).join('');
    return btoa(compressed);
  };

  const handleSendMessage = async (inputMessage, setInputMessage, replyTo = null) => {
    if (!inputMessage.trim() || !selectedContact || !user || isSending) return;

    setIsSending(true);
    const messageContent = inputMessage.trim();
    setInputMessage('');

    try {
      const messageData = {
        sender: user.email,
        content: messageContent,
        type: 'text',
        ...(replyTo && { replyTo: replyTo.id })
      };

      const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      const newMessage = {
        id: messageId,
        sender: user.email,
        content: messageContent,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: 'text',
        ...(replyTo && { replyTo: replyTo.id })
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: messageContent,
          sender: user.email,
          messageId: messageId,
          timestamp: newMessage.timestamp,
          type: 'text',
          ...(replyTo && { replyTo: replyTo.id })
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
      let compressedContent;
      let originalSize = file.size;
      
      if (type === 'image') {
        compressedContent = await compressFile(file);
      } else if (type === 'document') {
        compressedContent = await compressDocument(file);
      }

      const compressedSize = new Blob([compressedContent]).size;

      if (compressedSize > 1024 * 1024) {
        alert('File too large even after compression. Please choose a smaller file.');
        return;
      }

      const messageData = {
        sender: user.email,
        content: compressedContent,
        type: type,
        fileName: file.name,
        fileSize: compressedSize,
        fileType: file.type,
        originalSize: originalSize,
        compressedSize: compressedSize
      };

      const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      const newMessage = {
        id: messageId,
        sender: user.email,
        content: type === 'image' ? compressedContent : URL.createObjectURL(file),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: type,
        fileName: file.name,
        fileSize: compressedSize,
        fileType: file.type,
        originalSize: originalSize,
        compressedSize: compressedSize,
        isDelivered: false,
        isRead: false
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: compressedContent,
          sender: user.email,
          messageId: messageId,
          type: type,
          fileName: file.name,
          timestamp: newMessage.timestamp,
          fileSize: compressedSize,
          originalSize: originalSize
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