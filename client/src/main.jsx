import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import Chat from './Chat';
import './css/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </HashRouter>
);