import React, { useState, useRef, useEffect, useMemo } from 'react';
import './app.css';
import { FiSend, FiMic } from 'react-icons/fi';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import io from 'socket.io-client';

const initialContacts = [
  { id: 1, name: 'Alice', lastMessage: 'Hey, how are you?', time: '10:30 AM', unreadCount: 0 },
  { id: 2, name: 'Bob', lastMessage: 'Can we meet tomorrow?', time: 'Yesterday', unreadCount: 2 },
  { id: 3, name: 'Charlie', lastMessage: 'Thanks for the help!', time: 'Tuesday', unreadCount: 0 },
];

const initialMessages = [
  { id: 1, sender: 'Alice', content: 'Hey there!', time: '10:30 AM' },
  { id: 2, sender: 'You', content: 'Hi Alice, how are you?', time: '10:31 AM' },
  { id: 3, sender: 'Alice', content: 'I\'m good, thanks! How about you?', time: '10:32 AM' },
  { id: 4, sender: 'You', content: 'Doing well, thanks for asking!', time: '10:33 AM' },
];

function truncateMessage(message, maxLength = 30) {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
}

function App() {
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedContact, setSelectedContact] = useState(contacts[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const [init, setInit] = useState(false);

  const [socket, setSocket] = useState(null);

  useEffect(() => {
    //particle system
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });

    //socket
    const newSocket = io.connect("http://localhost:2000");
    setSocket(newSocket);

  }, []);

  const particlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      background: {
        color: {
          value: "transparent",
        },
      },
      fpsLimit: 120,
      interactivity: {
        events: {
          onClick: {
            enable: true,
            mode: "push",
          },
          onHover: {
            enable: true,
            mode: "repulse",
          },
        },
        modes: {
          push: {
            quantity: 4,
          },
          repulse: {
            distance: 200,
            duration: 0.4,
          },
        },
      },
      particles: {
        color: {
          value: "#128C7E",
        },
        links: {
          color: "#128C7E",
          distance: 150,
          enable: true,
          opacity: 0.5,
          width: 1,
        },
        move: {
          direction: "none",
          enable: true,
          outModes: {
            default: "bounce",
          },
          random: false,
          speed: 1,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 800,
          },
          value: 80,
        },
        opacity: {
          value: 0.5,
        },
        shape: {
          type: "circle",
        },
        size: {
          value: { min: 1, max: 5 },
        },
      },
      detectRetina: true,
    }),
    [],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const newMessage = {
        id: messages.length + 1,
        sender: 'You',
        content: inputMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setInputMessage('');

      const updatedContacts = contacts.map(contact => 
        contact.id === selectedContact.id 
          ? { ...contact, lastMessage: inputMessage.trim(), time: 'Just now', unreadCount: 0 }
          : contact
      );
      setContacts(updatedContacts);
      setSelectedContact(updatedContacts.find(c => c.id === selectedContact.id));
    }
  };

  const handleMicClick = () => {
    setIsRecording(!isRecording);
    console.log(isRecording ? 'Stopped recording' : 'Started recording');
  };

  const handleContactClick = (contact) => {
    setSelectedContact(contact);
    const updatedContacts = contacts.map(c => 
      c.id === contact.id ? { ...c, unreadCount: 0 } : c
    );
    setContacts(updatedContacts);
  };

  const simulateNewMessage = () => {
    const newMessage = {
      id: messages.length + 1,
      sender: selectedContact.name,
      content: 'This is a new message!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMessage]);

    const updatedContacts = contacts.map(contact => 
      contact.id === selectedContact.id 
        ? { ...contact, lastMessage: newMessage.content, time: 'Just now', unreadCount: contact.unreadCount + 1 }
        : contact
    );
    setContacts(updatedContacts);
  };

  return (
    <div className="app-container">
      <div className="chat-container">
        <div className="contact-list">
          <div className="contact-list-header">
            <h1>Chats</h1>
          </div>
          <div className="contact-list-scroll">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`contact-item ${selectedContact.id === contact.id ? 'selected' : ''}`}
                onClick={() => handleContactClick(contact)}
              >
                <img
                  src={`https://api.dicebear.com/6.x/initials/svg?seed=${contact.name}`}
                  alt={contact.name}
                  className="contact-avatar"
                />
                <div className="contact-info">
                  <div className="contact-name-time">
                    <h2>{contact.name}</h2>
                    <span>{contact.time}</span>
                  </div>
                  <p>{truncateMessage(contact.lastMessage)}</p>
                </div>
                {contact.unreadCount > 0 && (
                  <div className="unread-count">{contact.unreadCount}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <img
                src={`https://api.dicebear.com/6.x/initials/svg?seed=${selectedContact.name}`}
                alt={selectedContact.name}
                className="chat-header-avatar"
              />
              <h2>{selectedContact.name}</h2>
            </div>
            <button onClick={simulateNewMessage} className="simulate-message-btn">
              Simulate New Message
            </button>
          </div>

          <div className="messages-container">
            {init && (
              <Particles
                id="tsparticles"
                options={particlesOptions}
                className="particles-background"
              />
            )}
            <div className="messages-scroll">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender === 'You' ? 'sent' : 'received'}`}
                >
                  <div className="message-content">
                    <p>{message.content}</p>
                    <span className="message-time">{message.time}</span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="message-input-container">
            <input
              type="text"
              placeholder="Type a message"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="message-input"
            />
            <button type="button" className={`mic-button ${isRecording ? 'recording' : ''}`} onClick={handleMicClick}>
              <FiMic />
            </button>
            <button type="submit" className="send-button">
              <FiSend />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
