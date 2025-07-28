import { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const db = getFirestore();

const userStatusCache = new Map();

export const useUserStatus = (user) => {
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);

  const setOnline = useCallback(async (isVisible = true) => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const timestamp = Date.now();
      
      await updateDoc(userRef, {
        isOnline: true,
        isTabActive: isVisible,
        lastSeenTimestamp: timestamp,
        email: user.email,
        uid: user.uid
      });

      userStatusCache.set(user.email, {
        isOnline: true,
        isTabActive: isVisible,
        lastSeenTimestamp: timestamp
      });
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }, [user?.uid, user?.email]);

  const setOffline = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const timestamp = Date.now();
      
      await updateDoc(userRef, {
        isOnline: false,
        isTabActive: false,
        lastSeenTimestamp: timestamp
      });

      userStatusCache.set(user.email, {
        isOnline: false,
        isTabActive: false,
        lastSeenTimestamp: timestamp
      });
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }, [user?.uid, user?.email]);

  const updateTabVisibility = useCallback(async (isVisible) => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const timestamp = Date.now();
      
      await updateDoc(userRef, {
        isTabActive: isVisible,
        lastSeenTimestamp: timestamp
      });

      const cachedStatus = userStatusCache.get(user.email) || {};
      userStatusCache.set(user.email, {
        ...cachedStatus,
        isTabActive: isVisible,
        lastSeenTimestamp: timestamp
      });
    } catch (error) {
      console.error('Error updating tab visibility:', error);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!user?.uid) return;

    setOnline(isTabVisible);

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      
      if (isVisible) {
        setOnline(true);
      } else {
        updateTabVisibility(false);
      }
    };

    const handleFocus = () => {
      setIsTabVisible(true);
      setOnline(true);
    };

    const handleBlur = () => {
      setIsTabVisible(false);
      updateTabVisibility(false);
    };

    const handleBeforeUnload = () => {
      setOffline();
    };

    const handlePageHide = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    const statusInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setOnline(true);
      }
    }, 30000);

    return () => {
      clearInterval(statusInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      setOffline();
    };
  }, [user?.uid, setOnline, setOffline, updateTabVisibility, isTabVisible]);
};

export const useContactStatus = (contact) => {
  const [status, setStatus] = useState({ isOnline: false, lastSeen: 'recently' });
  const [contactData, setContactData] = useState(null);

  useEffect(() => {
    if (!contact?.email) {
      setStatus({ isOnline: false, lastSeen: 'recently' });
      setContactData(null);
      return;
    }

    const cachedStatus = userStatusCache.get(contact.email);
    if (cachedStatus) {
      const isOnline = cachedStatus.isOnline === true && cachedStatus.isTabActive === true;
      if (isOnline) {
        setStatus({ isOnline: true, lastSeen: 'Online' });
      } else {
        const formattedLastSeen = formatLastSeen(cachedStatus.lastSeenTimestamp);
        setStatus({ isOnline: false, lastSeen: formattedLastSeen });
      }
      return;
    }

    const findUserByEmail = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', contact.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = { id: userDoc.id, ...userDoc.data() };
          setContactData(userData);
          
          userStatusCache.set(contact.email, {
            isOnline: userData.isOnline,
            isTabActive: userData.isTabActive,
            lastSeenTimestamp: userData.lastSeenTimestamp
          });
          
          const isOnline = userData.isOnline === true && userData.isTabActive === true;
          if (isOnline) {
            setStatus({ isOnline: true, lastSeen: 'Online' });
          } else {
            const formattedLastSeen = formatLastSeen(userData.lastSeenTimestamp);
            setStatus({ isOnline: false, lastSeen: formattedLastSeen });
          }
        } else {
          setStatus({ isOnline: false, lastSeen: 'recently' });
          setContactData(null);
        }
      } catch (error) {
        console.error('Error finding user by email:', error);
        setStatus({ isOnline: false, lastSeen: 'recently' });
        setContactData(null);
      }
    };

    findUserByEmail();
  }, [contact?.email]);

  useEffect(() => {
    if (!contactData?.id) {
      return;
    }

    const userRef = doc(db, 'users', contactData.id);
    
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        
        userStatusCache.set(contact.email, {
          isOnline: userData.isOnline,
          isTabActive: userData.isTabActive,
          lastSeenTimestamp: userData.lastSeenTimestamp
        });
        
        const isOnline = userData.isOnline === true && userData.isTabActive === true;
        
        if (isOnline) {
          setStatus({ isOnline: true, lastSeen: 'Online' });
        } else {
          const formattedLastSeen = formatLastSeen(userData.lastSeenTimestamp);
          setStatus({ isOnline: false, lastSeen: formattedLastSeen });
        }
      } else {
        setStatus({ isOnline: false, lastSeen: 'recently' });
      }
    }, (error) => {
      console.error('Error listening to contact status:', error);
      setStatus({ isOnline: false, lastSeen: 'recently' });
    });

    return () => unsubscribe();
  }, [contactData?.id, contact?.email]);

  return status;
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'Seen recently';

  try {
    const now = new Date();
    const lastSeen = new Date(timestamp);
    
    if (isNaN(lastSeen.getTime())) return 'Seen recently';
    
    const diffInMs = now - lastSeen;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 2) return 'Seen recently';
    if (diffInMinutes < 60) return `Active ${diffInMinutes} minutes ago`;
    
    if (diffInHours < 24) {
      return `last seen at ${lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    if (diffInDays === 1) {
      return 'last seen yesterday';
    }
    
    if (diffInDays <= 6) {
      return `last seen ${diffInDays} days ago`;
    }
    
    if (diffInDays <= 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? 'last seen last week' : `last seen ${weeks} weeks ago`;
    }
    
    const months = Math.floor(diffInDays / 30);
    if (months === 1) return 'last seen last month';
    return `last seen ${months} months ago`;
  } catch (error) {
    console.error('Error formatting last seen:', error);
    return 'Seen recently';
  }
};