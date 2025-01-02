import React, { useState } from 'react';
import Chat from './chat';
import './css/signin.css';

function SignIn() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [contacts, setContacts] = useState({});

    const handleChange = (e) => {
        setEmail(e.target.value);
        setErrorMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://localhost:2000/getContacts/${email}`, {
                method: 'GET'                
            })

            response.json().then((data)=>{
                setContacts(data.contacts);
                setIsLoggedIn(true);
            })
        } catch (error) {
            setErrorMessage(error.message);
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