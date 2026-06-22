import React from 'react';
import { gameEntryUrl } from '../../lib/api';
import type { Game } from '../../types';

interface GameFrameProps {
  game: Pick<Game, 'slug' | 'entry_path' | 'title'>;
  /** Aspect ratio of the play area, e.g. '16 / 9'. Defaults to 16:9. */
  aspectRatio?: string;
}

/**
 * GameFrame is the single source of truth for running an untrusted user-uploaded
 * mini-game in isolation. Every place that plays a game (public play page, admin
 * preview) MUST go through this component so the sandbox rules live in one spot.
 *
 * Isolation guarantees:
 *  - `sandbox` grants only `allow-scripts` and `allow-pointer-lock`. Crucially it
 *    omits `allow-same-origin`, so the framed document is forced into a unique,
 *    opaque origin: its JS cannot read the app's cookies, localStorage, or make
 *    same-origin requests, and can never see the user's JWT.
 *  - No `allow-top-navigation`, `allow-forms`, `allow-modals`, or `allow-popups`.
 *  - The game is loaded from the API origin's /games-static route, which sets a
 *    strict CSP (connect-src 'none', frame-ancestors limited to our app) and
 *    X-Content-Type-Options: nosniff. See backend/internal/httpapi/game_static.go.
 *  - `referrerPolicy="no-referrer"` avoids leaking the app URL to the game.
 */
const GameFrame: React.FC<GameFrameProps> = ({ game, aspectRatio = '16 / 9' }) => {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio,
        background: '#000',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        overflow: 'hidden',
      }}
    >
      <iframe
        src={gameEntryUrl(game)}
        title={game.title || 'мини-игра'}
        sandbox="allow-scripts allow-pointer-lock"
        referrerPolicy="no-referrer"
        allow="fullscreen; gamepad; pointer-lock"
        loading="lazy"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  );
};

export default GameFrame;
