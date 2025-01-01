import React, { useState } from 'react';
import Chat from './chat';
import './css/signin.css';

function SignIn() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userID, setUserID] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [userData, setUserData] = useState(null);

    const handleChange = (e) => {
        setUserID(e.target.value);
        setErrorMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:2000/api/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userID })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Invalid user ID');
            }
            
            const userData = await response.json();
            setUserData(userData);
            setIsLoggedIn(true);
        } catch (error) {
            setErrorMessage(error.message);
        }
    };

    if (isLoggedIn && userData) {
        return <Chat userID={userID} userData={userData} />;
    }

    return (
        <div className="signin-container">
            <div className="background"></div>
            <div className="form-container">
                <h2>Sign In</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        name="userID"
                        placeholder="Enter User ID (format: user123)"
                        value={userID}
                        onChange={handleChange}
                        required
                    />
                    <button type="submit">Sign In</button>
                </form>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
}

export default SignIn;