import React, { useState, useRef, useEffect, useMemo } from 'react';
import './css/chat.css';
import { FiSend, FiMic } from 'react-icons/fi';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import io from 'socket.io-client';


function Chat(props) {
  const [contacts, setContacts] = useState({});
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const [init, setInit] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io.connect("http://localhost:2000");
    setSocket(newSocket);
    setContacts(props.contacts);
    
    // Set initial selected contact
    if (props.contacts && Object.keys(props.contacts).length > 0) {
      setSelectedContact(props.contacts[Object.keys(props.contacts)[0]]);
    }
    //initialize particles
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, [props.contacts]);

  useEffect(() => {
    if(socket){

      socket.on("joined-room", (data)=>{
        console.log("joined room", data.roomID);
        console.log("id : ", data.socketID);
      })
      socket.on("left-room", (data)=>{
        console.log("left room", data.roomID);
        console.log("id : ", data.socketID);
      })
      socket.on("received-message", (data)=>{
        console.log("message from : " ,data.socketID);
        console.log("in room : ", data.roomID);
      })
    }
  }, [socket]);

  const particlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      fpsLimit: 120,
      interactivity: {
        events: {
          onClick: { enable: true, mode: "push" },
          onHover: { enable: true, mode: "repulse" },
        },
        modes: {
          push: { quantity: 4 },
          repulse: { distance: 200, duration: 0.4 },
        },
      },
      particles: {
        color: { value: "#128C7E" },
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
          outModes: { default: "bounce" },
          random: false,
          speed: 1,
          straight: false,
        },
        number: {
          density: { enable: true, area: 800 },
          value: 80,
        },
        opacity: { value: 0.5 },
        shape: { type: "circle" },
        size: { value: { min: 1, max: 5 } },
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
    if (inputMessage.trim() && selectedContact) {
      const newMessage = {
        id: messages.length + 1,
        sender: 'You',
        content: inputMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setInputMessage('');
      
      if (socket) {
        socket.emit('send-message', {
          roomId: selectedContact.roomID,
          message: inputMessage.trim()
        });
      }
    }
  };

  const handleContactClick = (contact) => {
    setSelectedContact(contact);
  };

  return (
    <div className="app-container">
      <div className="chat-container">
        <div className="contact-list">
          <div className="contact-list-header">
            <h1>Chats</h1>
          </div>
          <div className="contact-list-scroll">
            {Object.entries(contacts).map(([key, contact]) => (
              <div
                key={key}
                className={`contact-item ${selectedContact?.roomID === contact.roomID ? 'selected' : ''}`}
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
                  </div>
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
            {selectedContact && (
              <div className="chat-header-info">
                <img
                  src={`https://api.dicebear.com/6.x/initials/svg?seed=${selectedContact.name}`}
                  alt={selectedContact.name}
                  className="chat-header-avatar"
                />
                <h2>{selectedContact.name}</h2>
              </div>
            )}
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
            <button
              type="button"
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
            >
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

export default Chat;