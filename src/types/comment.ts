import type { Profile } from './profile';

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
