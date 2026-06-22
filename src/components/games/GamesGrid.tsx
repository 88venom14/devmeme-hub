import React from 'react';
import GameCard from './GameCard';
import type { Game } from '../../types';

const GamesGrid: React.FC<{ games: Game[] }> = ({ games }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
    }}
  >
    {games.map((game) => (
      <GameCard key={game.id} game={game} />
    ))}
  </div>
);

export default GamesGrid;
