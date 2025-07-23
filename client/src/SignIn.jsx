import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      console.log('Attempting to sign in with:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful:', userCredential.user);
      navigate('/chat');
    } catch (error) {
      console.error('Sign in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // More specific error messages
      switch (error.code) {
        case 'auth/user-not-found':
          setErrorMessage('No account found with this email address.');
          break;
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
        case 'auth/network-request-failed':
          setErrorMessage('Network error. Please check your connection.');
          break;
        case 'auth/invalid-credential':
          setErrorMessage('Invalid email or password. Please check your credentials.');
          break;
        default:
          setErrorMessage(`Sign in failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="background"></div>
      <div className="form-container">
        <h2>Sign In</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <p>
          Don't have an account? <a href="/signup">Sign Up</a>
        </p>
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>
    </div>
  );
}

export default SignIn;