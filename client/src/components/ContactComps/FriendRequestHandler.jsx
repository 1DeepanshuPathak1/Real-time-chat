import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X, Users, Bell } from 'lucide-react';
import { getFirestore, collection, query, onSnapshot } from 'firebase/firestore';
import { useSocket } from '../../services/SocketService';
import { API_ENDPOINTS } from '../../config/api';
import '../css/FriendRequestHandler.css';

export const FriendRequestHandler = ({ user }) => {
  const [friendRequests, setFriendRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [loading, setLoading] = useState(false);

  const db = getFirestore();
  const { onFriendRequestReceived, onFriendRequestResponded, onFriendRequestAccepted } = useSocket();

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'friendRequests'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          senderId: doc.id,
          ...doc.data() 
        }));
        setFriendRequests(requestsData);
      }, (error) => {
        console.error('Firestore listener error:', error);
      });

      return () => unsubscribe();
    }
  }, [user, db]);

  useEffect(() => {
    const unsubscribeReceived = onFriendRequestReceived((data) => {
      setFriendRequests(prev => {
        const exists = prev.some(req => req.senderId === data.senderId);
        if (!exists) {
          return [...prev, {
            id: data.senderId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderEmail: data.senderEmail,
            timestamp: data.timestamp
          }];
        }
        return prev;
      });
    });

    const unsubscribeResponded = onFriendRequestResponded((data) => {
      if (data.response === 'reject') {
        setFriendRequests(prev => prev.filter(req => req.senderId !== data.userId));
      }
    });

    const unsubscribeAccepted = onFriendRequestAccepted((data) => {
      setFriendRequests(prev => prev.filter(req => req.senderId !== data.senderId));
    });

    return () => {
      unsubscribeReceived();
      unsubscribeResponded();
      unsubscribeAccepted();
    };
  }, [onFriendRequestReceived, onFriendRequestResponded, onFriendRequestAccepted]);

  const sendFriendRequest = async (recipientIdentifier) => {
    if (!user || !recipientIdentifier.trim()) return { success: false, message: 'Please enter a valid email or code' };

    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.SEND_FRIEND_REQUEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: user.uid,
          recipientIdentifier: recipientIdentifier.trim()
        }),
      });

      const responseData = await response.json();
      return response.ok 
        ? { success: true, message: 'Friend request sent successfully!' }
        : { success: false, message: responseData.error || 'Failed to send friend request' };
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const respondToFriendRequest = async (senderId, response) => {
    if (!user) return;

    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.RESPOND_FRIEND_REQUEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          senderId: senderId,
          response: response
        }),
      });

      if (res.ok) {
        setFriendRequests(prev => prev.filter(req => req.senderId !== senderId));
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    friendRequests,
    showRequests,
    setShowRequests,
    sendFriendRequest,
    respondToFriendRequest,
    loading,
    FriendRequestsModal: () => (
      showRequests && (
        <div className="friend-requests-modal">
          <div className="friend-requests-header">
            <h3>Friend Requests</h3>
            <button className="close-requests" onClick={() => setShowRequests(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="friend-requests-list">
            {loading ? (
              <div className="loading-requests">Loading...</div>
            ) : friendRequests.length === 0 ? (
              <div className="no-requests">
                <Users size={40} />
                <p>No friend requests</p>
              </div>
            ) : (
              friendRequests.map((request) => (
                <div key={request.senderId} className="friend-request-item">
                  <img
                    src={`https://api.dicebear.com/6.x/initials/svg?seed=${request.senderName}`}
                    alt={request.senderName}
                    className="request-avatar"
                  />
                  <div className="request-info">
                    <h4>{request.senderName}</h4>
                    <p>{request.senderEmail}</p>
                  </div>
                  <div className="request-actions">
                    <button
                      className="accept-button"
                      onClick={() => respondToFriendRequest(request.senderId, 'accept')}
                      disabled={loading}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="reject-button"
                      onClick={() => respondToFriendRequest(request.senderId, 'reject')}
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )
    ),
    FriendRequestBadge: () => (
      friendRequests.length > 0 && (
        <div className="friend-request-badge">
          <Bell size={16} />
          <span className="badge-count">{friendRequests.length}</span>
        </div>
      )
    )
  };
};