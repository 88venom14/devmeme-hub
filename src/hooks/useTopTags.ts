import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { TopTag } from '../types';

export function useTopTags(limit = 12) {
  return useQuery({
    queryKey: ['top-tags', limit],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TopTag[]> => {
      return api.listTopTags(limit);
    },
  });
}
