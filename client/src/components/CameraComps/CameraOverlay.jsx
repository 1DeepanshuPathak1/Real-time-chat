import React from 'react';
import { FiCamera } from 'react-icons/fi';

export const CameraOverlay = ({ videoRef, onCapture, onClose, stream }) => {
  return (
    <div className="camera-overlay">
      <video ref={videoRef} autoPlay playsInline className="camera-preview" />
      <div className="camera-controls">
        <button onClick={onCapture} className="capture-button">
          <FiCamera />
        </button>
        <button
          onClick={() => {
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
            onClose();
          }}
          className="close-camera-button"
        >
          Close
        </button>
      </div>
    </div>
  );
};