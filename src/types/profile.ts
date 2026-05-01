export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  website_url: string | null;
  github_url: string | null;
  youtube_url: string | null;
  twitch_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MyProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};
