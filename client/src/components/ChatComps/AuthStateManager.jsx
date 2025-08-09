import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

export const useAuthState = (auth, navigate) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('User authenticated:', currentUser.email);
        setUser(currentUser);
      } else {
        console.log('No user authenticated, redirecting to sign in');
        navigate('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  return { user, loading };
};