import React, { useState, useRef, useEffect, useMemo } from 'react';
import './css/chat.css';
import { FiSend, FiMic, FiSmile, FiPaperclip, FiImage, FiCamera, FiFile, FiUser, FiBarChart2, FiEdit } from 'react-icons/fi';
import io from 'socket.io-client';
// import { DrawingCanvas } from './components/drawing-canvas';
// import { MediaCarousel } from './components/media-carousel';
import { EmojiPickerComponent } from './components/EmojiPicker';
import { ParticlesBackground } from './components/ParticlesBackground';
import { ContactList } from './components/Contactlist';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { CameraOverlay } from './components/CameraOverlay';




function Chat(props) {
  const [contacts, setContacts] = useState({});
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const [init, setInit] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isDark, setIsDark] = useState(true);
  // const [showDrawing, setShowDrawing] = useState(false);

  useEffect(() => {
    const newSocket = io.connect("http://localhost:2000");
    setSocket(newSocket);
    setContacts(props.contacts);
    if (props.contacts && Object.keys(props.contacts).length > 0) {
      setSelectedContact(props.contacts[Object.keys(props.contacts)[0]]);
    }
    const handleClickOutside = (event) => {
      const emojiPicker = document.querySelector('.emoji-picker-container');
      const emojiButton = document.querySelector('.emoji-button');
      const attachMenu = document.querySelector('.attach-menu');
      const attachButton = document.querySelector('.attach-button');
      const themeToggleButton = document.querySelector('.theme-toggle-button');
      if (!emojiPicker?.contains(event.target) && !emojiButton?.contains(event.target) && !themeToggleButton?.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      
      if (!attachMenu?.contains(event.target) && !attachButton?.contains(event.target)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [props.contacts], [showEmojiPicker, showAttachMenu]);

  useEffect(() => {
    if (socket) {

      socket.on("joined-room", (data) => {
        console.log("joined room", data.roomID);
        console.log("id : ", data.socketID);
      })
      socket.on("left-room", (data) => {
        console.log("left room", data.roomID);
        console.log("id : ", data.socketID);
      })
      socket.on("received-message", (data) => {
        console.log("message from : ", data.socketID);
        console.log("in room : ", data.roomID);
      })
    }
  }, [socket]);

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

  const onEmojiClick = (emojiObject) => {
    setInputMessage(prevInput => prevInput + emojiObject.emoji);
  }

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newMessage = {
            id: messages.length + 1,
            sender: 'You',
            content: e.target.result,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'image'
          };
          setMessages([...messages, newMessage]);
        };
        reader.readAsDataURL(file);
      } else if (type === 'document') {
        const fileUrl = URL.createObjectURL(file);
        const newMessage = {
          id: messages.length + 1,
          sender: 'You',
          content: `📄 ${file.name}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'document',
          fileName: file.name,
          fileUrl: fileUrl
        };
        setMessages([...messages, newMessage]);
      }
    }
    setShowAttachMenu(false);
  };
  const handleDocumentClick = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      setStream(mediaStream);
      setShowCamera(true);
      setShowAttachMenu(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');

      const newMessage = {
        id: messages.length + 1,
        sender: 'You',
        content: imageData,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'image'
      };
      setMessages([...messages, newMessage]);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setShowCamera(false);
      setShowAttachMenu(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setIsDark(newTheme);
  };
  
  // const handleDrawingSend = (imageData) => {
  //   const newMessage = {
  //     id: message.length + 1,
  //     sender: 'You',
  //     content: imageData,
  //     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  //     type: 'image'
  //   };
  //   setMessages([...messages, newMessage]);
  // };

  return (
    <div className="app-container">
      <div className="chat-container">
        <ContactList
          contacts={contacts}
          selectedContact={selectedContact}
          onContactClick={setSelectedContact}
        />

        <div className="chat-window">
          <ChatHeader selectedContact={selectedContact} onThemeChange={handleThemeChange}  />

          <div className="messages-container">
            <ParticlesBackground />
            <MessageList
              messages={messages}
              messagesEndRef={messagesEndRef}
              handleDocumentClick={handleDocumentClick}
            />
          </div>

          {showCamera && (
            <CameraOverlay
              videoRef={videoRef}
              onCapture={captureImage}
              onClose={() => setShowCamera(false)}
              stream={stream}
            />
          )}
          {/* {showDrawing && (
            <DrawingCanvas
              onClose={() => setShowDrawing(false)}
              onSend={handleDrawingSend}
            />
          )} */}


          <form onSubmit={handleSendMessage} className="message-input-container">
            <button
              type="button"
              className="emoji-button"
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowEmojiPicker((prev) => !prev); 
                setShowAttachMenu(false); 
              }}
            >
              <FiSmile />
            </button>
            <button
              type="button"
              className="attach-button"
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowAttachMenu((prev) => !prev); 
                setShowEmojiPicker(false); 
              }}
            >
              <FiPaperclip />
            </button>
            {showAttachMenu && (
              <div className="attach-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => fileInputRef.current?.click()}>
                  <FiImage />
                  <span>Photos & videos</span>
                </button>
                <button onClick={startCamera}>
                  <FiCamera />
                  <span>Camera</span>
                </button>
                <button onClick={() => documentInputRef.current?.click()}>
                  <FiFile />
                  <span>Document</span>
                </button>
                <button onClick={() => {
                  setShowAttachMenu(false);
                }}>
                  <FiUser />
                  <span>Contact</span>
                </button>
                {/* <button onClick={() => {
                  setShowAttachMenu(false);
                  setShowDrawing(true);
                }}>
                  <FiEdit />
                  <span>Drawing</span>
                </button> */}
              </div>
            )}
            <EmojiPickerComponent 
              theme= {isDark ? 'dark' : 'light'}
              show={showEmojiPicker}
              onEmojiClick={onEmojiClick}
              onClick={(e) => e.stopPropagation()}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e, 'image')}
              accept="image/*,video/*"
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={documentInputRef}
              onChange={(e) => handleFileUpload(e, 'document')}
              accept=".doc,.docx,.pdf,.txt,.xls,.xlsx"
              style={{ display: 'none' }}
            />
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