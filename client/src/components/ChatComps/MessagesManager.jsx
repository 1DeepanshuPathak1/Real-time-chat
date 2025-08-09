import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import chunkedMessageService from '../../services/chunkedMessageService';

export const useMessagesManager = (selectedContact, user, isConnected, joinRoom, db) => {
  const [messages, setMessages] = useState([]);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentChunkId, setCurrentChunkId] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showStartMessage, setShowStartMessage] = useState(false);
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);

  useEffect(() => {
    if (selectedContact && user && isConnected) {
      console.log('Joining room:', selectedContact.roomID);
      joinRoom(selectedContact.roomID);

      setHasScrolledToUnread(false);
      setFirstUnreadIndex(-1);
      setMessages([]);
      setCurrentChunkId(null);
      setHasMoreMessages(true);
      setShowStartMessage(false);
      setPullDistance(0);
      setIsPulling(false);

      const loadInitialMessages = async () => {
        try {
          const result = await chunkedMessageService.getLatestMessages(selectedContact.roomID);

          console.log('Initial messages loaded:', result.messages.length);
          setMessages(result.messages);
          setCurrentChunkId(result.chunkId);
          setHasMoreMessages(result.hasMore);

          if (result.messages.length === 0) {
            setShowStartMessage(true);
          }

          const roomRef = doc(db, 'rooms', selectedContact.roomID);
          const roomDoc = await getDoc(roomRef);
          const lastReadTimestamp = roomDoc.data()?.[`lastReadTimestamp_${user.uid}`] || 0;

          const firstUnreadIdx = result.messages.findIndex(msg =>
            msg.sender !== user.email &&
            (msg.timestamp > lastReadTimestamp)
          );

          setFirstUnreadIndex(firstUnreadIdx);

        } catch (error) {
          console.error('Error loading initial messages:', error);
        }
      };

      loadInitialMessages();
    }
  }, [selectedContact, user, isConnected, joinRoom]);

  const loadOlderMessages = async () => {
    if (!selectedContact || !currentChunkId || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);

    try {
      const result = await chunkedMessageService.getOlderMessages(selectedContact.roomID, currentChunkId);

      if (result.messages.length > 0) {
        setMessages(prevMessages => [...result.messages, ...prevMessages]);
        setCurrentChunkId(result.chunkId);
        setHasMoreMessages(result.hasMore);

        if (!result.hasMore) {
          setShowStartMessage(true);
        }
      } else {
        setHasMoreMessages(false);
        setShowStartMessage(true);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop } = e.target;

    if (scrollTop <= 0 && hasMoreMessages && !loadingOlderMessages) {
      setIsPulling(true);
    } else if (isPulling && scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
    }

    if (isPulling && scrollTop < 0) {
      const distance = Math.abs(scrollTop);
      setPullDistance(Math.min(distance, 80));

      if (distance > 60) {
        setIsPulling(false);
        setPullDistance(0);
        e.target.scrollTop = 0;
        loadOlderMessages();
      }
    }
  };

  return {
    messages,
    setMessages,
    loadingOlderMessages,
    hasMoreMessages,
    pullDistance,
    isPulling,
    showStartMessage,
    hasScrolledToUnread,
    setHasScrolledToUnread,
    firstUnreadIndex,
    setFirstUnreadIndex,
    handleScroll
  };
};