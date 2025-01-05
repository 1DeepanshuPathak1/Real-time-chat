import { useRef, useState, useEffect } from 'react';
import { FiTrash2, FiRotateCcw, FiSend } from 'react-icons/fi';

export function DrawingCanvas({ onClose, onSend }) {
  const canvasRef = useRef(null);
  const [context, setContext] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [caption, setCaption] = useState('');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const lastPoint = useRef(null);
  const [undoStack, setUndoStack] = useState([]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setContext(ctx);
      }
    }
  }, [color, lineWidth]);

  const saveState = () => {
    if (canvasRef.current) {
      const imageData = canvasRef.current.toDataURL();
      setUndoStack([...undoStack, imageData]);
    }
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const newStack = [...undoStack];
      newStack.pop(); // Remove the last state
      setUndoStack(newStack);
      
      if (newStack.length > 0) {
        const img = new Image();
        img.src = newStack[newStack.length - 1];
        img.onload = () => {
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          context.drawImage(img, 0, 0);
        };
      } else {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const startDrawing = (e) => {
    if (!context) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    lastPoint.current = { x, y };
    
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
  };

  const draw = (e) => {
    if (!isDrawing || !context || !lastPoint.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(x, y);
    context.stroke();

    lastPoint.current = { x, y };
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPoint.current = null;
      saveState();
    }
  };

  const clearCanvas = () => {
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setUndoStack([]);
    }
  };

  const handleSend = () => {
    if (canvasRef.current) {
      const imageData = canvasRef.current.toDataURL('image/png');
      onSend(imageData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-[#1a1a1a] py-2 px-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center space-x-6">
          <button
            className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#333] rounded-full"
            onClick={undo}
          >
            <FiRotateCcw />
          </button>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded-full overflow-hidden cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24 accent-white"
          />
        </div>
        <button
          className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#333] rounded-full"
          onClick={clearCanvas}
        >
          <FiTrash2 />
        </button>
      </div>
      
      <div className="flex-1 relative bg-white">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            draw({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={stopDrawing}
        />
      </div>
      
      <div className="bg-[#1a1a1a] p-4 flex items-center space-x-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-[#333] text-white px-4 py-2 rounded-full focus:outline-none"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#00a884] text-white rounded-full hover:bg-[#008f6f]"
            onClick={handleSend}
          >
            <FiSend />
          </button>
        </div>
        <button
          className="px-4 py-2 text-white bg-[#333] rounded-full hover:bg-[#444]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
