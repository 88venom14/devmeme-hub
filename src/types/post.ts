import type { Profile } from './profile';
import type { Tag } from './tag';

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

export type PostWithMeta = Post & {
  profiles: Profile | null;
  stars: { count: number }[];
  comments: { count: number }[];
  post_tags?: { tags: Tag | null }[];
};
