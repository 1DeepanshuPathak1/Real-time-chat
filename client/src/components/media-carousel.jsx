import { useState, useEffect } from 'react';
import { FiDownload, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export function MediaCarousel({ media, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentMedia = media[currentIndex];
  const isVideo = currentMedia.type === 'video';

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentMedia.content;
    a.download = `whatsapp-media-${Date.now()}${isVideo ? '.mp4' : '.jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-6xl">
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            <FiDownload className="w-6 h-6" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {currentMedia.type === 'video' ? (
            <video
              src={currentMedia.content}
              className="w-full h-full object-contain"
              controls
              autoPlay
            />
          ) : (
            <img
              src={currentMedia.content}
              alt="Media preview"
              className="w-full h-full object-contain"
            />
          )}
          
          {media.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                <FiChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                <FiChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-4">
          {media.map((item, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden ${
                index === currentIndex ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-75'
              }`}
            >
              {item.type === 'video' ? (
                <video
                  src={item.content}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={item.content}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

