ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format CHECK (
    username::text = lower(username::text)
    AND username::text ~ '^[a-z0-9_][a-z0-9_.-]{2,31}$'
  );

ALTER TABLE public.tags
  ADD CONSTRAINT tags_name_format CHECK (
    name::text = lower(name::text)
    AND name::text ~ '^[a-z0-9][a-z0-9+#_.-]{0,39}$'
  );

ALTER TABLE public.posts
  ADD CONSTRAINT posts_content_md_length CHECK (
    content_md IS NULL OR length(content_md) <= 20000
  );
