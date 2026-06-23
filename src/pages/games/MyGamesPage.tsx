import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pencil, Trash2, Upload } from 'lucide-react';
import { useMyGames, useDeleteGame } from '@/hooks/useGames';
import GameStatusBadge from '@/components/games/GameStatusBadge';

const MyGamesPage: React.FC = () => {
  const { data: games, isLoading, error } = useMyGames();
  const deleteGame = useDeleteGame();

  const handleDelete = (slug: string, title: string) => {
    if (window.confirm(`Удалить игру «${title}»? Это действие необратимо.`)) {
      deleteGame.mutate(slug);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Мои игры</h1>
        <Link to="/games/upload" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
          <Upload size={14} /> Загрузить
        </Link>
      </div>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {games && games.length === 0 && !isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="text-secondary">Вы ещё не загрузили ни одной игры.</div>
        </div>
      )}

      {games?.map((game) => (
        <div key={game.id} style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--card-radius)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{game.title}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {new Date(game.created_at).toLocaleDateString('ru-RU')} · {game.play_count} запусков
              </div>
            </div>
            <GameStatusBadge status={game.status} />
          </div>

          {game.status === 'rejected' && game.rejection_reason && (
            <div style={{
              background: 'oklch(0.65 0.2 25 / 0.1)', border: '1px solid var(--error)',
              borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--error)',
            }}>
              <strong>Причина отклонения:</strong> {game.rejection_reason}
            </div>
          )}

          {game.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {game.tags.map((t) => (
                <span key={t.id} style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>#{t.name}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {game.status === 'approved' && (
              <Link to={`/games/${encodeURIComponent(game.slug)}`} className="btn btn-sm" style={btnGhost}>
                <Play size={13} /> Играть
              </Link>
            )}
            <Link to={`/games/upload?edit=${encodeURIComponent(game.slug)}`} className="btn btn-sm" style={btnGhost}>
              <Pencil size={13} /> {game.status === 'rejected' ? 'Исправить и переотправить' : 'Редактировать'}
            </Link>
            <button onClick={() => handleDelete(game.slug, game.title)} className="btn btn-sm"
              style={{ ...btnGhost, color: 'var(--error)' }} disabled={deleteGame.isPending}>
              <Trash2 size={13} /> Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '6px 12px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
  textDecoration: 'none',
};

export default MyGamesPage;
