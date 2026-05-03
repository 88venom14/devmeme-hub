import React from 'react';

interface Props {
  size?: number;
}

const FluttershyAvatar: React.FC<Props> = ({ size = 28 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      background: 'linear-gradient(135deg, oklch(0.85 0.08 90), oklch(0.75 0.12 350))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: Math.round(size * 0.5),
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.15)',
      userSelect: 'none',
    }}
    title="Fluttershy"
  >
    F
  </div>
);

export default FluttershyAvatar;
