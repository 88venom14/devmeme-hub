import React, { useState } from 'react';
import { Ban, X } from 'lucide-react';

type BanModalProps = {
  username: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, durationDays: number) => void;
};

// Preset ban durations in days; 0 means permanent.
const PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Навсегда' },
  { value: 1, label: '1 день' },
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: -1, label: 'Другой срок…' },
];

/** Modal for choosing a ban reason and duration. */
const BanModal: React.FC<BanModalProps> = ({ username, pending, error, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState(0);
  const [customDays, setCustomDays] = useState(3);

  const durationDays = preset === -1 ? Math.max(1, customDays || 0) : preset;

  const confirm = () => onConfirm(reason.trim(), durationDays);

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
          width: '100%', maxWidth: 420,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--card-radius)', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)' }}>
            <Ban size={18} /> Бан @{username}
          </h2>
          <button onClick={onCancel} aria-label="Закрыть" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Причина (необязательно)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Например: спам, оскорбления…"
            style={{
              resize: 'vertical', padding: '8px 10px', fontSize: 14,
              background: 'var(--bg-2)', color: 'var(--text-1)',
              border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit',
            }}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Срок</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => {
              const active = preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  style={{
                    padding: '6px 12px', fontSize: 13, borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'var(--bg-2)',
                    color: active ? '#000' : 'var(--text-2)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {preset === -1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="number"
                min={1}
                max={3650}
                value={customDays}
                onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: 90, padding: '6px 10px', fontSize: 14,
                  background: 'var(--bg-2)', color: 'var(--text-1)',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>дней</span>
            </div>
          )}
        </div>

        {error && <div className="mono" style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={pending}
            style={{
              padding: '8px 14px', fontSize: 13, borderRadius: 8,
              cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
              background: 'var(--error)', border: '1px solid var(--error)', color: '#fff', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Ban size={14} /> {pending ? 'Баню…' : durationDays === 0 ? 'Забанить навсегда' : `Забанить на ${durationDays} дн.`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BanModal;
