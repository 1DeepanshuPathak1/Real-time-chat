import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { createMessage } from '../services/messageServices';

const db = getFirestore();

export const useMessageHandlers = (setMessages, socket, selectedContact, user) => {
  const handleSendMessage = async (inputMessage, setInputMessage) => {
    if (inputMessage.trim() && selectedContact && user) {
      const messageData = {
        sender: user.email,
        content: inputMessage.trim(),
        time: new Date().toISOString(),
        type: 'text'
      };

      const docRef = await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
      setMessages(prev => [...prev, { ...messageData, id: docRef.id }]);
      setInputMessage('');

      if (socket) {
        socket.emit('send-message', {
          roomID: selectedContact.roomID,
          message: messageData,
          sender: user.email
        });
      }
    }
  };

  const handleFileUpload = async (file, type) => {
    if (file && selectedContact && user) {
      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const messageData = {
            sender: user.email,
            content: e.target.result,
            time: new Date().toISOString(),
            type: 'image'
          };

          const docRef = await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
          setMessages(prev => [...prev, { ...messageData, id: docRef.id }]);
        };
        reader.readAsDataURL(file);
      } else if (type === 'document') {
        const messageData = {
          sender: user.email,
          content: `📄 ${file.name}`,
          time: new Date().toISOString(),
          type: 'document',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        };

        const docRef = await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
        setMessages(prev => [...prev, { ...messageData, id: docRef.id }]);
      }
    }
  };

  return { handleSendMessage, handleFileUpload };
};