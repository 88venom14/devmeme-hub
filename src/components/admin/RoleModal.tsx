import React from 'react';
import { ShieldPlus, ShieldMinus, X } from 'lucide-react';

type RoleModalProps = {
  username: string;
  // The role the user will be moved TO.
  nextRole: 'user' | 'moderator';
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation modal for granting or revoking the moderator role. */
const RoleModal: React.FC<RoleModalProps> = ({ username, nextRole, pending, error, onCancel, onConfirm }) => {
  const granting = nextRole === 'moderator';
  const Icon = granting ? ShieldPlus : ShieldMinus;
  const accent = granting ? '#d08700' : 'var(--text-2)';
  const title = granting ? 'Выдать модератора' : 'Снять модератора';

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
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: accent }}>
            <Icon size={18} /> {title}
          </h2>
          <button onClick={onCancel} aria-label="Закрыть" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {granting ? (
            <>Выдать пользователю <b>@{username}</b> роль модератора? Он сможет банить обычных пользователей.</>
          ) : (
            <>Снять с <b>@{username}</b> роль модератора? Он снова станет обычным пользователем.</>
          )}
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
              background: granting ? '#d08700' : 'var(--bg-2)',
              border: `1px solid ${granting ? '#d08700' : 'var(--border)'}`,
              color: granting ? '#000' : 'var(--text-1)', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon size={14} /> {pending ? 'Сохраняю…' : granting ? 'Выдать' : 'Снять'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleModal;
