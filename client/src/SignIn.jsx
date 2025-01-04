import React, { useState } from 'react';
import Chat from './chat';
import './css/signin.css';

function SignIn() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userID, setUserID] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [userData, setUserData] = useState(null);
    const [contacts, setContacts] = useState([]);

    const handleChange = (e) => {
        setUserID(e.target.value);
        setErrorMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        
        try {
            const userResponse = await fetch(`http://localhost:2000/findUser/${userID}`, {
                method: 'GET'
            });
            
            if (!userResponse.ok) {
                const error = await userResponse.json();
                throw new Error(error.error || 'Invalid user ID');
            }
            
            const userData = await userResponse.json();
            setUserData(userData);

            const contactsResponse = await fetch(`http://localhost:2000/getContacts/${userID}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!contactsResponse.ok) {
                throw new Error('Failed to load contacts');
            }
    
            const contactsData = await contactsResponse.json();
            setContacts(contactsData);
            setIsLoggedIn(true); 
            
        } catch (error) {
            setErrorMessage(error.message);
            setIsLoggedIn(false);
            setUserData(null);
            setContacts([]);
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