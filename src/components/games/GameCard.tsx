import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Play } from 'lucide-react';
import Avatar from '@/components/common/Avatar';
import type { Game } from '../../types';

const GameCard: React.FC<{ game: Game }> = ({ game }) => {
  const author = game.author;
  return (
    <Link
      to={`/games/${encodeURIComponent(game.slug)}`}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)', overflow: 'hidden',
        textDecoration: 'none', color: 'inherit',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '16 / 9', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {game.thumbnail_url ? (
          <img src={game.thumbnail_url} alt={game.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Gamepad2 size={40} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
        )}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 999,
          background: 'oklch(0 0 0 / 0.6)', color: '#fff',
          fontSize: 11, fontFamily: 'var(--font-mono)',
        }}>
          <Play size={11} /> {game.play_count}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: 'var(--text-1)' }}>
          {game.title}
        </h3>

        {game.description && (
          <p style={{
            margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {game.description}
          </p>
        )}

        {game.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {game.tags.slice(0, 4).map((t) => (
              <span key={t.id} style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                #{t.name}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
          <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} size={22} />
          <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {author?.display_name || author?.username || 'аноним'}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default GameCard;
