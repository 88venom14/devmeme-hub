import React from 'react';
import { RotateCcw, X } from 'lucide-react';

type UnbanModalProps = {
  username: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation modal for lifting a user's ban. */
const UnbanModal: React.FC<UnbanModalProps> = ({ username, pending, error, onCancel, onConfirm }) => {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--card-radius)', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-1)' }}>
            <RotateCcw size={18} /> Разбанить @{username}
          </h2>
          <button onClick={onCancel} aria-label="Закрыть" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Снять блокировку с <b>@{username}</b>? Пользователь снова получит доступ к сайту.
        </p>

        {error && <div className="mono" style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            style={{
              padding: '8px 14px', fontSize: 13, borderRadius: 8,
              cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
              background: 'var(--accent)', border: '1px solid var(--accent)', color: '#000', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <RotateCcw size={14} /> {pending ? 'Снимаю…' : 'Разбанить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnbanModal;
