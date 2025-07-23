import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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
  const [showMessage, setShowMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      console.log('Creating user with email:', formData.email);
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      console.log('User created successfully:', userCredential.user);
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        createdAt: new Date().toISOString()
      });
      console.log('User data saved to Firestore');
      
      // Send email verification
      try {
        await sendEmailVerification(userCredential.user);
        console.log('Verification email sent');
        setShowMessage(true);
        setTimeout(() => navigate('/'), 3000);
      } catch (emailError) {
        console.warn('Could not send verification email:', emailError);
        // Still proceed with account creation
        setShowMessage(true);
        setTimeout(() => navigate('/'), 2000);
      }
      
    } catch (error) {
      console.error('Sign up error:', error);
      console.error('Error code:', error.code);
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          setErrorMessage('An account with this email already exists.');
          break;
        case 'auth/invalid-email':
          setErrorMessage('Invalid email address format.');
          break;
        case 'auth/weak-password':
          setErrorMessage('Password should be at least 6 characters long.');
          break;
        case 'auth/network-request-failed':
          setErrorMessage('Network error. Please check your connection.');
          break;
        default:
          setErrorMessage(`Sign up failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="background"></div>
      <div className="form-container">
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <p>
          Already have an account? <a href="/">Sign In</a>
        </p>
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        {showMessage && (
          <div className="success-message">
            Account created successfully! A verification email has been sent. Redirecting to Sign In...
          </div>
        )}
      </div>
    </div>
  );
}

export default SignUp;