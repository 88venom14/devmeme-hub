import React, { useState } from 'react';
import { Check, X, Ban } from 'lucide-react';
import { useApproveGame, useRejectGame, useRemoveGame } from '../../hooks/useGames';
import type { Game } from '../../types';

/**
 * ModerationActions renders the approve / reject / remove controls for a single
 * game. Reject and remove collect an optional/required reason in an inline form.
 */
const ModerationActions: React.FC<{ game: Game }> = ({ game }) => {
  const approve = useApproveGame();
  const reject = useRejectGame();
  const remove = useRemoveGame();
  const [mode, setMode] = useState<null | 'reject' | 'remove'>(null);
  const [reason, setReason] = useState('');

  const pending = approve.isPending || reject.isPending || remove.isPending;

  const submitReason = () => {
    if (mode === 'reject') {
      if (!reason.trim()) return;
      reject.mutate({ slug: game.slug, reason: reason.trim() }, { onSuccess: reset });
    } else if (mode === 'remove') {
      remove.mutate({ slug: game.slug, reason: reason.trim() || undefined }, { onSuccess: reset });
    }
  };

  const reset = () => { setMode(null); setReason(''); };

  if (mode) {
    const isReject = mode === 'reject';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          autoFocus
          placeholder={isReject ? 'Причина отклонения (обязательно)…' : 'Причина снятия (необязательно)…'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          style={{
            width: '100%', minHeight: 60, resize: 'vertical',
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 10px', color: 'var(--text-1)', fontSize: 13, fontFamily: 'var(--font-ui)',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submitReason} disabled={pending || (isReject && !reason.trim())}
            style={{ ...actionBtn, color: isReject ? 'var(--error)' : 'var(--text-1)', opacity: (isReject && !reason.trim()) ? 0.5 : 1 }}>
            {isReject ? 'Отклонить' : 'Снять'}
          </button>
          <button onClick={reset} style={actionBtn}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {game.status !== 'approved' && (
        <button onClick={() => approve.mutate(game.slug)} disabled={pending}
          style={{ ...actionBtn, color: 'oklch(0.78 0.15 145)' }}>
          <Check size={13} /> Одобрить
        </button>
      )}
      {game.status !== 'rejected' && (
        <button onClick={() => setMode('reject')} disabled={pending}
          style={{ ...actionBtn, color: 'var(--error)' }}>
          <X size={13} /> Отклонить
        </button>
      )}
      {game.status === 'approved' && (
        <button onClick={() => setMode('remove')} disabled={pending}
          style={{ ...actionBtn, color: 'var(--text-2)' }}>
          <Ban size={13} /> Снять с публикации
        </button>
      )}
    </div>
  );
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '6px 12px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
};

export default ModerationActions;
