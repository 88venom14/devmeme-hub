import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Upload, Search } from 'lucide-react';
import { useGames } from '../hooks/useGames';
import { useSessionContext } from '../context/SessionContext';
import GamesGrid from '../components/games/GamesGrid';
import { inputStyle } from '../styles/forms';

const GamesPage: React.FC = () => {
  const session = useSessionContext();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: games, isLoading, error } = useGames({
    q: query.trim() || undefined,
    tag: activeTag || undefined,
  });

  // Tag chips derived from the currently loaded games.
  const tags = useMemo(() => {
    const set = new Map<string, number>();
    for (const g of games ?? []) for (const t of g.tags) set.set(t.name, (set.get(t.name) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name]) => name);
  }, [games]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Gamepad2 size={24} style={{ color: 'var(--accent)' }} /> Мини-игры
        </h1>
        {session && (
          <Link to="/games/upload" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <Upload size={14} /> Загрузить игру
          </Link>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input
          type="text" placeholder="Поиск игр…"
          style={{ ...inputStyle, paddingLeft: 32 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {activeTag && (
            <button onClick={() => setActiveTag(null)}
              style={chipStyle(false)}>× очистить</button>
          )}
          {tags.map((name) => (
            <button key={name} onClick={() => setActiveTag(name === activeTag ? null : name)}
              style={chipStyle(name === activeTag)}>#{name}</button>
          ))}
        </div>
      )}

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {games && games.length > 0 && <GamesGrid games={games} />}

      {games && games.length === 0 && !isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="text-secondary">
            {query || activeTag ? 'Ничего не найдено.' : 'Пока нет опубликованных игр. Будьте первым — загрузите свою!'}
          </div>
        </div>
      )}
    </div>
  );
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    background: active ? 'var(--accent)' : 'var(--bg-2)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 999,
    color: active ? 'oklch(0.15 0.01 60)' : 'var(--text-2)',
    fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
  };
}

export default GamesPage;
