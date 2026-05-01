import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type MyProfile = { username: string; display_name: string | null; avatar_url: string | null };

export const useMyProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ['my-profile', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', userId!)
        .single();
      return data as MyProfile | null;
    },
  });
