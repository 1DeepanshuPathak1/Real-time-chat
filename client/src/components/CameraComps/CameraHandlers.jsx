import { useState } from 'react';
import chunkedMessageService from '../../services/chunkedMessageService';

export const useCameraHandlers = (setMessages, videoRef, selectedContact, user) => {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

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
      setCapturedImage(null);
      
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
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      
      const compressedImageData = await compressImage(imageData);
      setCapturedImage(compressedImageData);
      return compressedImageData;
    }
    return null;
  };

  const confirmSendImage = async () => {
    if (!capturedImage || !selectedContact || !user) return false;

    const compressedSize = new Blob([capturedImage]).size;

    if (compressedSize > 1024 * 1024) {
      alert('Image too large even after compression. Please try again.');
      return false;
    }

    const messageData = {
      sender: user.email,
      content: capturedImage,
      type: 'image',
      fileName: `camera_capture_${Date.now()}.jpg`,
      fileSize: compressedSize,
      fileType: 'image/jpeg'
    };

    try {
      const messageId = await chunkedMessageService.sendMessage(selectedContact.roomID, messageData);

      const newMessage = {
        id: messageId,
        sender: user.email,
        content: capturedImage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: 'image',
        fileName: messageData.fileName,
        fileSize: compressedSize
      };
      
      setMessages(prev => [...prev, newMessage]);
      setCapturedImage(null);
      
      return true;
    } catch (error) {
      console.error('Error saving captured image:', error);
      return false;
    }
  };

  const cancelCapture = () => {
    setCapturedImage(null);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
  };

  return { 
    startCamera, 
    captureImage, 
    confirmSendImage, 
    cancelCapture, 
    stopCamera, 
    stream, 
    capturedImage 
  };
};