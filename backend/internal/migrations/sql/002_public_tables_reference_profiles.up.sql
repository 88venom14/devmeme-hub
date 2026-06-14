ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.stars
  DROP CONSTRAINT IF EXISTS stars_user_id_fkey;
ALTER TABLE public.stars
  ADD CONSTRAINT stars_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.follows
  DROP CONSTRAINT IF EXISTS follows_follower_id_fkey,
  DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE public.follows
  ADD CONSTRAINT follows_follower_id_fkey
  FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT follows_following_id_fkey
  FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.saved_posts
  DROP CONSTRAINT IF EXISTS saved_posts_user_id_fkey;
ALTER TABLE public.saved_posts
  ADD CONSTRAINT saved_posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_activity
  DROP CONSTRAINT IF EXISTS user_activity_user_id_fkey;
ALTER TABLE public.user_activity
  ADD CONSTRAINT user_activity_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_user_id_fkey;
ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_messages_conversation_owner_fk;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT chat_messages_conversation_owner_fk
  FOREIGN KEY (conversation_id, user_id)
  REFERENCES public.chat_conversations(id, user_id)
  ON DELETE CASCADE;
