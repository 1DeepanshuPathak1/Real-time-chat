import { useState } from 'react';

export const useUIState = () => {
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactStatus, setSelectedContactStatus] = useState({ isOnline: false, lastSeen: 'recently' });
  const [replyTo, setReplyTo] = useState(null);

  return {
    inputMessage,
    setInputMessage,
    isRecording,
    setIsRecording,
    showEmojiPicker,
    setShowEmojiPicker,
    showAttachMenu,
    setShowAttachMenu,
    showCamera,
    setShowCamera,
    isDark,
    setIsDark,
    selectedContact,
    setSelectedContact,
    selectedContactStatus,
    setSelectedContactStatus,
    replyTo,
    setReplyTo
  };
};