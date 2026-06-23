import React, { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { useGame } from '@/hooks/useGames';
import { api } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import GameFrame from '@/components/games/GameFrame';

const GamePlayPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: game, isLoading, error } = useGame(slug);
  const counted = useRef(false);

  // Count a play once per page view for approved games. Failures are silent —
  // a play-count bump is not worth surfacing an error to the player.
  useEffect(() => {
    if (game && game.status === 'approved' && !counted.current) {
      counted.current = true;
      api.playGame(game.slug).catch(() => {});
    }
  }, [game]);

  if (isLoading) return <div className="mono text-secondary">ЗАГРУЗКА...</div>;
  if (error || !game) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="text-secondary" style={{ marginBottom: 12 }}>Игра не найдена или ещё не опубликована.</div>
        <Link to="/games" className="btn btn-primary btn-sm">К списку игр</Link>
      </div>
    );
  }

  const author = game.author;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920, margin: '0 auto' }}>
      <Link to="/games" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Все игры
      </Link>

      <GameFrame game={game} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{game.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} size={24} />
            <Link to={`/profile/${author?.username}`} style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' }}>
              {author?.display_name || author?.username}
            </Link>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <Play size={14} /> {game.play_count} запусков
        </div>
      </div>

      {game.description && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {game.description}
        </p>
      )}

      {game.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {game.tags.map((t) => (
            <Link key={t.id} to={`/games?tag=${encodeURIComponent(t.name)}`}
              style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
              #{t.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GamePlayPage;
