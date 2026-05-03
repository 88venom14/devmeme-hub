import React from 'react';
import FluttershyAvatar from './FluttershyAvatar';

const TypingIndicator: React.FC = () => (
  <>
    <style>{`
      @keyframes typingDot {
        0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
        40% { opacity: 1; transform: translateY(-3px); }
      }
    `}</style>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <FluttershyAvatar size={26} />
      <div
        style={{
          padding: '9px 12px',
          borderRadius: 12,
          borderTopLeftRadius: 4,
          background: 'var(--bg-2)',
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--text-3)',
              animation: `typingDot 1.2s ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  </>
);

export default TypingIndicator;
