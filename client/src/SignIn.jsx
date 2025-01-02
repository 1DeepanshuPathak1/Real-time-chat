import React, { useState } from 'react';
import Chat from './chat';
import './css/signin.css';

function SignIn() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [userData, setUserData] = useState(null);
    const [contacts, setContacts] = useState([]);

    const handleChange = (e) => {
        setEmail(e.target.value);
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

    if (isLoggedIn && contacts!=null) {
        return <Chat email={email} contacts={contacts} />;
    }

    return (
        <div className="signin-container">
            <div className="background"></div>
            <div className="form-container">
                <h2>Sign In</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        name="email"
                        placeholder="Enter User ID (format: user123)"
                        value={email}
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