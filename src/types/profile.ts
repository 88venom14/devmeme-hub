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
  // Set by the backend when the profile is followers-only and the viewer is
  // not allowed to see its full content.
  is_private?: boolean;
  // Set by the backend when the owner hid their liked posts from other viewers.
  liked_hidden?: boolean;
  // Populated by the backend only when the viewer is a moderator or admin:
  // the account's role and ban state, for the moderation banner on the profile.
  moderation?: ProfileModeration;
};

export type ProfileModeration = {
  role: 'user' | 'moderator' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  ban_reason?: string | null;
  locked_until?: string | null;
};

export type MyProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};
