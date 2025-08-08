import { useState } from 'react';
import chunkedMessageService from '../../services/chunkedMessageService';

export const useCameraHandlers = (setMessages, videoRef, selectedContact, user) => {
  const [stream, setStream] = useState(null);

  const compressImage = (dataUrl) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve) => {
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
      
      img.src = dataUrl;
    });
  };

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

  const captureImage = async () => {
    if (videoRef.current && selectedContact && user) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const originalImageData = canvas.toDataURL('image/jpeg');
      
      const compressedImageData = await compressImage(originalImageData);
      const compressedSize = new Blob([compressedImageData]).size;
      const originalSize = new Blob([originalImageData]).size;

      if (compressedSize > 1024 * 1024) {
        alert('Image too large even after compression. Please try again.');
        return false;
      }

      const messageData = {
        sender: user.email,
        content: compressedImageData,
        type: 'image',
        fileName: `camera_capture_${Date.now()}.jpg`,
        fileSize: compressedSize,
        fileType: 'image/jpeg',
        originalSize: originalSize,
        compressedSize: compressedSize
      };

      try {
        const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

        const newMessage = {
          id: messageId,
          sender: user.email,
          content: compressedImageData,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          type: 'image',
          fileName: messageData.fileName,
          fileSize: compressedSize,
          originalSize: originalSize
        };
        
        setMessages(prev => [...prev, newMessage]);

        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        return true;
      } catch (error) {
        console.error('Error saving captured image:', error);
        return false;
      }
    }
    return false;
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return { startCamera, captureImage, stopCamera, stream };
};