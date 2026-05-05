import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import FluttershyAvatar from './FluttershyAvatar';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any = [[rehypeHighlight, { detect: true, ignoreMissing: true }]];
const remarkPlugins = [remarkGfm];

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
        className={isUser ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-ai md'}
        style={{
          maxWidth: '78%',
          padding: '7px 11px',
          borderRadius: 12,
          background: isUser ? 'var(--accent)' : 'var(--bg-2)',
          color: isUser ? 'oklch(0.15 0.01 60)' : 'var(--text-1)',
          fontSize: 13,
          lineHeight: 1.45,
          wordBreak: 'break-word',
          opacity: pending ? 0.7 : 1,
          borderTopLeftRadius: !isUser ? 4 : 12,
          borderTopRightRadius: isUser ? 4 : 12,
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
