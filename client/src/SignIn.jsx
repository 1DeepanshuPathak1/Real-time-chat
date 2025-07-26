import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { API_ENDPOINTS } from './config/api';
import './css/signin.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const verifyUser = async (email) => {
    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_USER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('User not found');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      // First verify if user exists in our database
      try {
        await verifyUser(email);
      } catch (error) {
        if (error.message === 'User not found') {
          setErrorMessage('No account found with this email address. Please sign up.');
          setIsLoading(false);
          return;
        }
        throw error;
      }

      // If user exists, try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        // Optional: You can still let them sign in but show a warning
        console.warn('Email not verified');
      }
      navigate('/chat');
    } catch (error) {
      console.error('Sign in error:', error);
      switch (error.code) {
        case 'auth/wrong-password':
          setErrorMessage('Incorrect password. Please try again.');
          break;
        case 'auth/invalid-email':
          setErrorMessage('Invalid email address format.');
          break;
        case 'auth/user-disabled':
          setErrorMessage('This account has been disabled.');
          break;
        case 'auth/too-many-requests':
          setErrorMessage('Too many failed attempts. Please try again later.');
          break;
        default:
          setErrorMessage('An error occurred during sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
        {errorMessage && <div className="auth-error">{errorMessage}</div>}
      </div>
    </div>
  );
}

export default SignIn;