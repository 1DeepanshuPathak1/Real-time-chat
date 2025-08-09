import { useCallback } from 'react';

export const useEventHandlers = (
  selectedContact,
  isConnected,
  leaveRoom,
  setSelectedContact,
  setReplyTo,
  updateContactUnreadCount,
  handleSendMessage,
  moveContactToTop,
  replyTo,
  setSelectedContactStatus,
  confirmSendImage,
  setShowCamera,
  stopCamera,
  cancelCapture
) => {
  const handleContactClick = (contact) => {
    if (selectedContact && isConnected) {
      leaveRoom(selectedContact.roomID);
    }
    setSelectedContact(contact);
    setReplyTo(null);
    updateContactUnreadCount(contact.roomID, { unreadCount: 0 });
  };

  const handleDocumentClick = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleThemeChange = (newTheme, setIsDark) => {
    setIsDark(newTheme);
  };

  const handleSendMessageWrapper = useCallback(async (inputMessage, setInputMessage) => {
    const messageData = {
      content: inputMessage,
      replyTo: replyTo
    };

    await handleSendMessage(messageData.content, setInputMessage, messageData.replyTo);
    if (selectedContact) {
      moveContactToTop(selectedContact.roomID);
    }
    setReplyTo(null);
  }, [handleSendMessage, selectedContact, moveContactToTop, replyTo]);

  const handleContactStatusUpdate = useCallback((contactEmail, status) => {
    if (selectedContact && selectedContact.email === contactEmail) {
      setSelectedContactStatus(status);
    }
  }, [selectedContact]);

  const handleReply = (message) => {
    setReplyTo(message);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleCameraConfirm = async () => {
    const success = await confirmSendImage();
    if (success) {
      setShowCamera(false);
      stopCamera();
      if (selectedContact) {
        moveContactToTop(selectedContact.roomID);
      }
    }
  };

  const handleCameraCancel = () => {
    cancelCapture();
  };

  const handleCameraClose = () => {
    stopCamera();
    setShowCamera(false);
  };

  return {
    handleContactClick,
    handleDocumentClick,
    handleThemeChange,
    handleSendMessageWrapper,
    handleContactStatusUpdate,
    handleReply,
    handleCancelReply,
    handleCameraConfirm,
    handleCameraCancel,
    handleCameraClose
  };
};