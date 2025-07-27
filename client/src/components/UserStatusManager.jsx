import { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, onSnapshot, updateDoc, serverTimestamp, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const db = getFirestore();

export const useUserStatus = (user) => {
  const setOnline = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        email: user.email,
        uid: user.uid
      }, { merge: true });
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }, [user?.uid, user?.email]);

  const setOffline = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    setOnline();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => setOnline(), 100);
      }
    };

    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    const statusInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setOnline();
      }
    }, 15000);

    return () => {
      clearInterval(statusInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      setOffline();
    };
  }, [user?.uid, setOnline, setOffline]);
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

    const findUserByEmail = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', contact.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = { id: userDoc.id, ...userDoc.data() };
          setContactData(userData);
          
          const isOnline = userData.isOnline === true;
          if (isOnline) {
            setStatus({ isOnline: true, lastSeen: 'Online' });
          } else {
            const lastSeenTimestamp = userData.lastSeen;
            const formattedLastSeen = formatLastSeen(lastSeenTimestamp);
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
        const isOnline = userData.isOnline === true;
        
        if (isOnline) {
          setStatus({ isOnline: true, lastSeen: 'Online' });
        } else {
          const lastSeenTimestamp = userData.lastSeen;
          const formattedLastSeen = formatLastSeen(lastSeenTimestamp);
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
  }, [contactData?.id]);

  return status;
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'Seen recently';

  try {
    const now = new Date();
    const lastSeen = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
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