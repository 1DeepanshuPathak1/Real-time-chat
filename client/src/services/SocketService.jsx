import { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, user }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (user && !socketRef.current) {
      console.log('Initializing socket connection for user:', user.uid);
      
      const newSocket = io('https://potential-couscous-gvqx4q97w55fvx5w-3001.app.github.dev', {
        transports: ['websocket'],
        path: '/socket.io',
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        auth: {
          token: user.uid
        }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setNetworkError(false);
        newSocket.emit('user-connected', user.uid);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setNetworkError(true);
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      newSocket.on('reconnect_attempt', (attempt) => {
        console.log('Attempting to reconnect:', attempt);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [user]);

  const joinRoom = (roomId) => {
    if (socket && isConnected) {
      socket.emit('join-room', roomId);
    }
  };

  const leaveRoom = (roomId) => {
    if (socket && isConnected) {
      socket.emit('leave-room', roomId);
    }
  };

  const sendMessage = (roomId, message, sender) => {
    if (socket && isConnected) {
      socket.emit('send-message', { roomID: roomId, message, sender });
    }
  };

  const onMessageReceived = (callback) => {
    if (socket) {
      socket.on('received-message', callback);
      return () => socket.off('received-message', callback);
    }
  };

  const onFriendRequestReceived = (callback) => {
    if (socket) {
      socket.on('friend-request-received', callback);
      return () => socket.off('friend-request-received', callback);
    }
  };

  const onFriendRequestResponded = (callback) => {
    if (socket) {
      socket.on('friend-request-responded', callback);
      return () => socket.off('friend-request-responded', callback);
    }
  };

  const onFriendRequestAccepted = (callback) => {
    if (socket) {
      socket.on('friend-request-accepted', callback);
      return () => socket.off('friend-request-accepted', callback);
    }
  };

  const value = {
    socket,
    isConnected,
    networkError,
    joinRoom,
    leaveRoom,
    sendMessage,
    onMessageReceived,
    onFriendRequestReceived,
    onFriendRequestResponded,
    onFriendRequestAccepted
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};