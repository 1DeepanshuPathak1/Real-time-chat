import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { createMessage } from '../services/messageServices';

const db = getFirestore();

export const useMessageHandlers = (setMessages, socket, selectedContact) => {
  const handleSendMessage = async (inputMessage, setInputMessage) => {
    if (inputMessage.trim() && selectedContact) {
      const newMessage = createMessage(inputMessage.trim());
      await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), {
        ...newMessage,
        sender: selectedContact.email
      });
      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: inputMessage.trim(),
          sender: selectedContact.email
        });
      }
    }
  };

  const handleFileUpload = async (file, type) => {
    if (file) {
      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const newMessage = createMessage(e.target.result, 'image');
          await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), {
            ...newMessage,
            sender: selectedContact.email
          });
          setMessages(prev => [...prev, newMessage]);
        };
        reader.readAsDataURL(file);
      } else if (type === 'document') {
        const newMessage = createMessage(`📄 ${file.name}`, 'document', file);
        await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), {
          ...newMessage,
          sender: selectedContact.email
        });
        setMessages(prev => [...prev, newMessage]);
      }
    }
  };

  return { handleSendMessage, handleFileUpload };
};