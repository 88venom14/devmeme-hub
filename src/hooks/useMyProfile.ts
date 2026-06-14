import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MyProfile } from '../types';

export const useMyProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ['my-profile', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      return api.getMyProfileMini() as Promise<MyProfile | null>;
    },
  });
