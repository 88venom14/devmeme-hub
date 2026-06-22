import type { Profile } from './profile';
import type { Tag } from './tag';

export type GameStatus = 'pending' | 'approved' | 'rejected' | 'removed';

export type Game = {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  entry_path: string;
  archive_size: number | null;
  status: GameStatus;
  rejection_reason: string | null;
  play_count: number;
  created_at: string;
  updated_at: string;
  author: Profile;
  tags: Tag[];
};

export type AdminGamesResponse = {
  games: Game[];
  counts: Partial<Record<GameStatus, number>>;
};

export type GameModerationLogEntry = {
  id: string;
  game_id: string;
  moderator_id: string | null;
  action: 'approved' | 'rejected' | 'removed' | 'resubmitted';
  reason: string | null;
  created_at: string;
};
