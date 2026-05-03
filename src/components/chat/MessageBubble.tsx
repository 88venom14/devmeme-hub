import React from 'react';
import FluttershyAvatar from './FluttershyAvatar';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

const MessageBubble: React.FC<Props> = ({ role, content, pending }) => {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexDirection: isUser ? 'row-reverse' : 'row',
        animation: 'slideUp 0.18s ease',
      }}
    >
      {!isUser && <FluttershyAvatar size={26} />}
      <div
        style={{
          maxWidth: '78%',
          padding: '7px 11px',
          borderRadius: 12,
          background: isUser ? 'var(--accent)' : 'var(--bg-2)',
          color: isUser ? 'oklch(0.15 0.01 60)' : 'var(--text-1)',
          fontSize: 13,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: pending ? 0.7 : 1,
          borderTopLeftRadius: !isUser ? 4 : 12,
          borderTopRightRadius: isUser ? 4 : 12,
        }}
      >
        {content}
      </div>
    </div>
  );
};

export default MessageBubble;
