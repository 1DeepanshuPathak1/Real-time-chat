import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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
const db = getFirestore(app);

function SignUp() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const checkIfUserExists = async (email) => {
    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_USER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      return response.ok; // if ok, user exists
    } catch (error) {
      return false; // if error, user doesn't exist
    }
  };

  const createUserInDb = async (userData) => {
    try {
      const response = await fetch(API_ENDPOINTS.CREATE_USER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match!');
      setIsLoading(false);
      return;
    }

    try {
      // First check if user exists in our database
      const userExists = await checkIfUserExists(formData.email);
      if (userExists) {
        setErrorMessage('An account with this email already exists. Please sign in.');
        setIsLoading(false);
        return;
      }

      // If user doesn't exist, create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      try {
        // Then create user in our database
        await createUserInDb({
          uid: userCredential.user.uid,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email
        });
        
        // If successful, redirect to sign in
        setErrorMessage('Account created successfully! Please sign in.');
        setTimeout(() => navigate('/'), 2000);
      } catch (dbError) {
        // If database creation fails, delete the Firebase auth user
        await userCredential.user.delete();
        throw new Error('Failed to create user profile. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setErrorMessage('An account with this email already exists. Please sign in.');
          break;
        case 'auth/invalid-email':
          setErrorMessage('Invalid email address format.');
          break;
        case 'auth/weak-password':
          setErrorMessage('Password should be at least 6 characters long.');
          break;
        case 'auth/operation-not-allowed':
          setErrorMessage('Email/password accounts are not enabled. Please contact support.');
          break;
        default:
          setErrorMessage(error.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              name="password"
              placeholder="Password (min 6 characters)"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/">Sign In</Link>
        </p>
        {errorMessage && <div className="auth-error">{errorMessage}</div>}
      </div>
    </div>
  );
}

export default SignUp;