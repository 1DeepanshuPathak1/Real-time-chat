import { FiCamera, FiCheck, FiX } from 'react-icons/fi';

export const CameraOverlay = ({ 
  videoRef, 
  onCapture, 
  onConfirm, 
  onCancel, 
  onClose, 
  stream, 
  capturedImage 
}) => {
  return (
    <div className="camera-overlay">
      {!capturedImage ? (
        <>
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
        </>
      ) : (
        <>
          <div className="image-preview-containers">
            <img src={capturedImage} alt="Captured" className="captured-image-preview" />
          </div>
          <div className="camera-controls confirmation-controls">
            <button onClick={onCancel} className="cancel-buttons">
              <FiX />
            </button>
            <button onClick={onConfirm} className="confirm-button">
              <FiCheck />
            </button>
          </div>
        </>
      )}
    </div>
  );
};