export const downloadDocument = async (message) => {
  try {
    let downloadData;
    let fileName = message.fileName || 'document';
    
    if (message.content.startsWith('data:')) {
      downloadData = message.content;
    } else {
      const blob = new Blob([message.content], { type: message.fileType || 'application/octet-stream' });
      downloadData = URL.createObjectURL(blob);
    }
    
    const link = document.createElement('a');
    link.href = downloadData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (!message.content.startsWith('data:')) {
      URL.revokeObjectURL(downloadData);
    }
  } catch (error) {
    console.error('Error downloading document:', error);
    alert('Failed to download document');
  }
};

export const downloadImage = async (message) => {
  try {
    const link = document.createElement('a');
    link.href = message.content;
    link.download = message.fileName || `image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading image:', error);
    alert('Failed to download image');
  }
};

import { useState } from 'react';

export const useImagePreview = () => {
  const [imagePreview, setImagePreview] = useState({ show: false, src: '', fileName: '' });

  const previewImage = (src, fileName) => {
    setImagePreview({ show: true, src, fileName });
  };

  const closeImagePreview = () => {
    setImagePreview({ show: false, src: '', fileName: '' });
  };

  return { imagePreview, previewImage, closeImagePreview };
};