import React from 'react';
import type { GameStatus } from '../../types';

const STATUS_META: Record<GameStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'На модерации', color: 'oklch(0.8 0.13 85)', bg: 'oklch(0.8 0.13 85 / 0.12)' },
  approved: { label: 'Опубликовано', color: 'oklch(0.78 0.15 145)', bg: 'oklch(0.78 0.15 145 / 0.12)' },
  rejected: { label: 'Отклонено', color: 'var(--error)', bg: 'oklch(0.65 0.2 25 / 0.12)' },
  removed: { label: 'Снято', color: 'var(--text-3)', bg: 'var(--bg-2)' },
};

const GameStatusBadge: React.FC<{ status: GameStatus }> = ({ status }) => {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.color}`,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
};

export default GameStatusBadge;
