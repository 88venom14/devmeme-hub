-- Mini-games: user-uploaded, self-contained web bundles that go through a
-- moderation queue before becoming publicly playable.
--
-- Admin capability reuses the existing public.users.role column
-- (CHECK role IN ('user', 'moderator', 'admin') from migration 001); no new
-- column is needed. Grant admin with:
--   UPDATE public.users SET role = 'admin' WHERE email = '<addr>';

CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  entry_path TEXT NOT NULL DEFAULT 'index.html',
  storage_path TEXT NOT NULL,
  archive_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- The reason from the most recent rejection, surfaced to the author. The full
  -- audit trail lives in game_moderation_log.
  rejection_reason TEXT,
  play_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT games_slug_format CHECK (
    slug = lower(slug) AND slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'
  ),
  CONSTRAINT games_title_length CHECK (length(trim(title)) BETWEEN 1 AND 150),
  CONSTRAINT games_description_length CHECK (
    description IS NULL OR length(description) <= 2000
  ),
  CONSTRAINT games_entry_path_not_empty CHECK (length(trim(entry_path)) > 0),
  CONSTRAINT games_storage_path_not_empty CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT games_status_valid CHECK (
    status IN ('pending', 'approved', 'rejected', 'removed')
  ),
  CONSTRAINT games_play_count_nonnegative CHECK (play_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.game_tags (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.game_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  -- Keep the audit row even if the moderator account is later deleted.
  moderator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_moderation_log_action_valid CHECK (
    action IN ('approved', 'rejected', 'removed', 'resubmitted')
  )
);

CREATE INDEX IF NOT EXISTS idx_games_status_created_at
  ON public.games(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_author_id_created_at
  ON public.games(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_tags_tag_id_game_id
  ON public.game_tags(tag_id, game_id);
CREATE INDEX IF NOT EXISTS idx_game_moderation_log_game_id_created_at
  ON public.game_moderation_log(game_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_games_updated_at ON public.games;
CREATE TRIGGER trg_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
