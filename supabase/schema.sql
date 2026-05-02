-- DevMeme schema (matches applied migrations: initial_schema + perf_indexes_and_rls_initplan)

-- Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT,
  image_url TEXT,
  video_url TEXT,
  github_url TEXT,
  github_repo_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.post_tags (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE public.saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX idx_stars_user_id ON public.stars(user_id);
CREATE INDEX idx_follows_following_id ON public.follows(following_id);
CREATE INDEX idx_post_tags_tag_id ON public.post_tags(tag_id);
CREATE INDEX idx_saved_posts_post_id ON public.saved_posts(post_id);
CREATE INDEX idx_user_activity_user_id ON public.user_activity(user_id);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Policies (auth.* wrapped in (select ...) for InitPlan caching)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Stars are viewable by everyone" ON public.stars FOR SELECT USING (true);
CREATE POLICY "Authenticated users can star posts" ON public.stars FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Users can unstar posts" ON public.stars FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Authenticated users can follow" ON public.follows FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING ((select auth.uid()) = follower_id);

CREATE POLICY "Tags are viewable by everyone" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags" ON public.tags FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Post tags are viewable by everyone" ON public.post_tags FOR SELECT USING (true);
CREATE POLICY "Post owners can manage tags" ON public.post_tags FOR INSERT WITH CHECK (
  (select auth.uid()) = (SELECT user_id FROM public.posts WHERE id = post_id)
);
CREATE POLICY "Post owners can remove tags" ON public.post_tags FOR DELETE USING (
  (select auth.uid()) = (SELECT user_id FROM public.posts WHERE id = post_id)
);

CREATE POLICY "Users can view own saved posts" ON public.saved_posts FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Authenticated users can save posts" ON public.saved_posts FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own activity" ON public.user_activity FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Authenticated users can log activity" ON public.user_activity FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

-- API role grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Auto-create profile after email confirmation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- INSERT: OAuth users confirmed immediately
  IF TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  -- UPDATE: email/password user confirmed their email
  ELSIF TG_OP = 'UPDATE'
    AND OLD.email_confirmed_at IS NULL
    AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
