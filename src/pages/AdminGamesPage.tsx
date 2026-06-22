import React, { useState } from 'react';
import { useAdminGames } from '../hooks/useGames';
import ModerationQueue from '../components/games/ModerationQueue';
import AdminNav from '../components/admin/AdminNav';
import type { GameStatus } from '../types';

type Filter = GameStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'На модерации' },
  { value: 'approved', label: 'Опубликованы' },
  { value: 'rejected', label: 'Отклонены' },
  { value: 'removed', label: 'Сняты' },
  { value: 'all', label: 'Все' },
];

const AdminGamesPage: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('pending');
  const { data, isLoading, error } = useAdminGames(filter === 'all' ? undefined : filter);

  const counts = data?.counts ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, margin: '0 auto' }}>
      <AdminNav />

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const count = f.value === 'all' ? undefined : counts[f.value as GameStatus];
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px',
                background: active ? 'var(--accent)' : 'var(--bg-2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, cursor: 'pointer',
                color: active ? 'oklch(0.15 0.01 60)' : 'var(--text-2)',
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}>
              {f.label}
              {count != null && count > 0 && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {data && data.games.length === 0 && !isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="text-secondary">Здесь пусто.</div>
        </div>
      )}

      {data && data.games.length > 0 && <ModerationQueue games={data.games} />}
    </div>
  );
};

export default AdminGamesPage;
