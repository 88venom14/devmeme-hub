import type { CSSProperties } from 'react';

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 5,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  fontFamily: 'var(--font-ui)',
  outline: 'none',
};
