import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ScrollText } from 'lucide-react';
import Avatar from '../Avatar';
import GameFrame from './GameFrame';
import GameStatusBadge from './GameStatusBadge';
import ModerationActions from './ModerationActions';
import { useGameModerationLog } from '../../hooks/useGames';
import type { Game } from '../../types';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} МБ`;
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

const ModerationLog: React.FC<{ slug: string }> = ({ slug }) => {
  const { data: log, isLoading } = useGameModerationLog(slug);
  if (isLoading) return <div className="mono text-secondary" style={{ fontSize: 12 }}>загрузка журнала…</div>;
  if (!log || log.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Журнал пуст.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {log.map((e) => (
        <div key={e.id} style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-2)' }}>{e.action}</span>
          {' · '}{new Date(e.created_at).toLocaleString('ru-RU')}
          {e.reason ? ` · ${e.reason}` : ''}
        </div>
      ))}
    </div>
  );
};

const QueueItem: React.FC<{ game: Game }> = ({ game }) => {
  const [preview, setPreview] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const author = game.author;

  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 'var(--card-radius)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{game.title}</h3>
            <GameStatusBadge status={game.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} size={20} />
            <Link to={`/profile/${author?.username}`} style={{ fontSize: 12, color: 'var(--text-2)', textDecoration: 'none' }}>
              {author?.display_name || author?.username}
            </Link>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              · {new Date(game.created_at).toLocaleDateString('ru-RU')} · {formatBytes(game.archive_size)} · {game.play_count} запусков
            </span>
          </div>
        </div>
      </div>

      {game.description && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{game.description}</p>
      )}

      {game.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {game.tags.map((t) => (
            <span key={t.id} style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>#{t.name}</span>
          ))}
        </div>
      )}

      {/* Sandboxed preview */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setPreview((p) => !p)} style={smallBtn}>
          {preview ? <EyeOff size={13} /> : <Eye size={13} />} {preview ? 'Скрыть превью' : 'Превью игры'}
        </button>
        <button onClick={() => setShowLog((s) => !s)} style={smallBtn}>
          <ScrollText size={13} /> Журнал
        </button>
      </div>

      {preview && <GameFrame game={game} />}
      {showLog && <ModerationLog slug={game.slug} />}

      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <ModerationActions game={game} />
      </div>
    </div>
  );
};

const smallBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '6px 12px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
};

const ModerationQueue: React.FC<{ games: Game[] }> = ({ games }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {games.map((game) => <QueueItem key={game.id} game={game} />)}
  </div>
);

export default ModerationQueue;
