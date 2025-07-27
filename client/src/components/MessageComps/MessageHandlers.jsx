import { getFirestore, collection, addDoc } from 'firebase/firestore';

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

      try {
        await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
        setInputMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
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

          try {
            await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
          } catch (error) {
            console.error('Error sending image:', error);
          }
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

        try {
          await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), messageData);
        } catch (error) {
          console.error('Error sending document:', error);
        }
      }
    }
  };

  return { handleSendMessage, handleFileUpload };
};