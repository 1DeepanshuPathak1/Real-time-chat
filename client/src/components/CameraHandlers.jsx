import React, { useState } from 'react';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { createMessage } from '../services/messageServices';

const db = getFirestore();

export const useCameraHandlers = (setMessages, videoRef) => {
  const [stream, setStream] = useState(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }
      });
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      return mediaStream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      return null;
    }
  };

  const captureImage = async (selectedContact) => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');

      const newMessage = createMessage(imageData, 'image');
      await addDoc(collection(db, 'rooms', selectedContact.roomID, 'messages'), {
        ...newMessage,
        sender: selectedContact.email
      });
      setMessages(prev => [...prev, newMessage]);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      return true;
    }
    return false;
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  return { startCamera, captureImage, stopCamera, stream };
};