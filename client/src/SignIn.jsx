import React, { useState } from 'react';
import Chat from './Chat';
import './css/signin.css';

function SignIn() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userID, setUserID] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e) => {
        setUserID(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (userID.trim()) {
            setIsLoggedIn(true); // Set the login state to true
        } else {
            setErrorMessage('User ID is required');
        }
    };

    if (isLoggedIn) {
        return <Chat userID={userID} />;
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
                        placeholder="Enter User ID"
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
