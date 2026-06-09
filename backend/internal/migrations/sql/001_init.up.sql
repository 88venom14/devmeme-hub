CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending',
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_not_empty CHECK (length(trim(email::text)) > 3),
  CONSTRAINT users_password_hash_valid CHECK (
    password_hash IS NULL OR length(trim(password_hash)) >= 20
  ),
  CONSTRAINT users_role_valid CHECK (role IN ('user', 'moderator', 'admin')),
  CONSTRAINT users_status_valid CHECK (status IN ('pending', 'active', 'suspended')),
  CONSTRAINT users_failed_login_attempts_nonnegative CHECK (failed_login_attempts >= 0)
);

CREATE TABLE IF NOT EXISTS public.auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email CITEXT,
  raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_identities_provider_valid CHECK (provider IN ('github', 'google')),
  CONSTRAINT auth_identities_provider_user_id_not_empty CHECK (
    length(trim(provider_user_id)) > 0
  ),
  CONSTRAINT auth_identities_provider_user_unique UNIQUE (provider, provider_user_id),
  CONSTRAINT auth_identities_user_provider_unique UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_sessions_refresh_token_hash_not_empty CHECK (
    length(trim(refresh_token_hash)) >= 32
  ),
  CONSTRAINT user_sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username CITEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website_url TEXT,
  github_url TEXT,
  youtube_url TEXT,
  twitch_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_username_format CHECK (
    username::text = lower(username::text)
    AND username::text ~ '^[a-z0-9_][a-z0-9_.-]{2,31}$'
  ),
  CONSTRAINT profiles_display_name_length CHECK (
    display_name IS NULL OR length(display_name) <= 80
  ),
  CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 500)
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT,
  image_url TEXT,
  video_url TEXT,
  github_url TEXT,
  github_repo_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT posts_title_length CHECK (
    length(trim(title)) BETWEEN 1 AND 150
  ),
  CONSTRAINT posts_description_length CHECK (
    description IS NULL OR length(description) <= 2000
  ),
  CONSTRAINT posts_content_md_length CHECK (
    content_md IS NULL OR length(content_md) <= 20000
  )
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comments_id_post_id_unique UNIQUE (id, post_id),
  CONSTRAINT comments_parent_same_post_fk FOREIGN KEY (parent_id, post_id)
    REFERENCES public.comments(id, post_id)
    ON DELETE CASCADE,
  CONSTRAINT comments_text_not_empty CHECK (length(trim(text)) > 0),
  CONSTRAINT comments_text_length CHECK (length(text) <= 5000)
);

CREATE TABLE IF NOT EXISTS public.stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stars_post_user_unique UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follows_follower_following_unique UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tags_name_format CHECK (
    name::text = lower(name::text)
    AND name::text ~ '^[a-z0-9][a-z0-9+#_.-]{0,39}$'
  )
);

CREATE TABLE IF NOT EXISTS public.post_tags (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_posts_user_post_unique UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_activity_type_not_empty CHECK (length(trim(activity_type)) > 0)
);

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_conversations_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT chat_conversations_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT chat_conversations_title_length CHECK (length(title) <= 120)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_messages_conversation_owner_fk FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.chat_conversations(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT chat_messages_role_valid CHECK (role IN ('user', 'assistant')),
  CONSTRAINT chat_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_users_status_created_at
  ON public.users(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin
  ON public.users USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id
  ON public.auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_raw_profile_gin
  ON public.auth_identities USING GIN (raw_profile);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_expires_at
  ON public.user_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON public.user_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at
  ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_github_repo_json_gin
  ON public.posts USING GIN (github_repo_json)
  WHERE github_repo_json IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at
  ON public.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id_created_at
  ON public.comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id_created_at
  ON public.comments(parent_id, created_at ASC)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stars_user_id_created_at
  ON public.stars(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_following_id_created_at
  ON public.follows(following_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id_post_id
  ON public.post_tags(tag_id, post_id);

CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id_created_at
  ON public.saved_posts(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id_created_at
  ON public.user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type_created_at
  ON public.user_activity(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_metadata_gin
  ON public.user_activity USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id_updated_at
  ON public.chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id_created_at
  ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_created_at
  ON public.chat_messages(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_auth_identities_updated_at ON public.auth_identities;
CREATE TRIGGER trg_auth_identities_updated_at
  BEFORE UPDATE ON public.auth_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
