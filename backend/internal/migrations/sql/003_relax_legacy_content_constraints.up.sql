ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_name_format;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_content_md_length;
