import { useEffect } from 'react';
import chunkedMessageService from '../../services/chunkedMessageService';
import './css/MessageReactions.css';

export const useMessageReactions = (messageReactions, setMessageReactions, selectedContact, user, socket) => {
  const handleReactionClick = async (message, emoji) => {
    if (!message || !emoji || !selectedContact || !user) return;

    const currentReactions = messageReactions[message.id] || {};
    const users = currentReactions[emoji] || [];
    const userName = user.displayName || user.email;
    
    if (!users.includes(userName)) return;

    const newUsers = users.filter(u => u !== userName);
    const newReactions = { ...currentReactions };
    
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newUsers;
    }

    setMessageReactions(prev => ({
      ...prev,
      [message.id]: newReactions
    }));

    try {
      const messageData = {
        messageId: message.id,
        emoji: emoji,
        userName: userName,
        remove: true
      };

      await chunkedMessageService.addReactionToMessage(selectedContact.roomID, messageData);

      if (socket) {
        socket.emit('message-reaction', {
          roomId: selectedContact.roomID,
          messageId: message.id,
          reactions: newReactions,
          userName: userName
        });
      }

    } catch (error) {
      console.error('Error removing emoji reaction:', error);
      setMessageReactions(prev => ({
        ...prev,
        [message.id]: currentReactions
      }));
    }
  };

  return { handleReactionClick };
};

export const MessageReactions = ({ message, messageReactions, user, contacts, selectedContact, isDark, onReactionClick }) => {
  const reactions = messageReactions[message.id];
  
  if (!reactions || Object.keys(reactions).length === 0) return null;

  const reactionElements = Object.entries(reactions).map(([emoji, users], index) => {
    if (!users || users.length === 0) return null;

    const isOwn = users.includes(user.displayName || user.email);
    const count = users.length;
    const formatUserName = (userIdentifier) => {
      if (userIdentifier === (user.displayName || user.email)) {
        return 'You';
      }
      
      const contact = contacts?.find(c => c.email === userIdentifier);
      if (contact) {
        return contact.name;
      }
      
      if (userIdentifier === selectedContact?.email) {
        return selectedContact.name;
      }
      
      return userIdentifier;
    };

    const tooltipText = count === 1 
      ? `${formatUserName(users[0])} reacted with ${emoji}`
      : users.length === 2
        ? `${users.map(formatUserName).join(' and ')} reacted with ${emoji}`
        : `${users.slice(0, -1).map(formatUserName).join(', ')} and ${formatUserName(users[users.length - 1])} reacted with ${emoji}`;

    return (
      <div 
        key={`${emoji}-${index}`}
        className={`message-reaction ${isOwn ? 'own-reaction' : 'other-reaction'} ${isDark ? 'dark-theme' : 'light-theme'}`}
        onClick={() => isOwn && onReactionClick && onReactionClick(message, emoji)}
        title={tooltipText}
        style={{ cursor: isOwn ? 'pointer' : 'default' }}
      >
        <span className="reaction-emoji">{emoji}</span>
        {count > 1 && <span className="reaction-count">{count}</span>}
      </div>
    );
  }).filter(Boolean);

  if (reactionElements.length === 0) return null;

  return (
    <div className="message-reactions-container">
      {reactionElements}
    </div>
  );
};