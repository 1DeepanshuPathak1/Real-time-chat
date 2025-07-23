import React, { useState } from 'react';
import { FiX, FiSend } from 'react-icons/fi';

interface PollCreatorProps {
  onClose: () => void;
  onSend: (pollData: {
    question: string;
    options: string[];
    allowMultiple: boolean;
  }) => void;
}

export function PollCreator({ onClose, onSend }: PollCreatorProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const addOption = () => {
    if (options.length < 12) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    if (question.trim() && options.filter(opt => opt.trim()).length >= 2) {
      onSend({
        question: question.trim(),
        options: options.filter(opt => opt.trim()),
        allowMultiple
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="bg-[#1a1a1a] p-4">
        <h2 className="text-white text-xl font-semibold">Create a poll</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Type poll question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-[#333] text-white px-4 py-3 rounded focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-white text-sm font-medium">Options</h3>
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="flex-1 bg-[#333] text-white px-4 py-2 rounded focus:outline-none"
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(index)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <FiX />
                </button>
              )}
            </div>
          ))}
          {options.length < 12 && (
            <button
              onClick={addOption}
              className="w-full py-2 px-4 bg-[#333] text-white rounded hover:bg-[#444] transition-colors"
            >
              + Add option
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="allowMultiple"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="rounded bg-[#333] text-[#128C7E] focus:ring-0"
          />
          <label htmlFor="allowMultiple" className="text-white">
            Allow multiple answers
          </label>
        </div>
      </div>
      <div className="bg-[#1a1a1a] p-4 flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-white hover:bg-[#333] rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!question.trim() || options.filter(opt => opt.trim()).length < 2}
          className="px-4 py-2 bg-[#128C7E] text-white rounded disabled:opacity-50"
        >
          <FiSend className="inline-block mr-2" />
          Send
        </button>
      </div>
    </div>
  );
}