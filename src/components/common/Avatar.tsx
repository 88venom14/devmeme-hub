import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 36 }) => {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const fontSize = Math.round(size * 0.38);

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 700,
    }}>{initial}</div>
  );
};

export default Avatar;
