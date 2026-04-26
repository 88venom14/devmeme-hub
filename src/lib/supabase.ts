import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
};

export type GithubRepoData = {
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  full_name?: string;
};

export type Post = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content_md: string | null;
  image_url: string | null;
  video_url: string | null;
  github_url: string | null;
  github_repo_json: GithubRepoData | null;
  created_at: string;
  updated_at: string;
};

export type Tag = { id: string; name: string };

// Result of feed select with aggregated counts and tags
export type PostWithMeta = Post & {
  profiles: Profile | null;
  stars: { count: number }[];
  comments: { count: number }[];
  post_tags?: { tags: Tag | null }[];
};

export const POST_SELECT = `
  *,
  profiles:user_id (*),
  stars:stars(count),
  comments:comments(count),
  post_tags(tags(id, name))
`;

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
};
