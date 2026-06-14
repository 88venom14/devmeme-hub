import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const POST_KEYS = new Set([
  'posts',
  'post',
  'profile-posts',
  'saved-posts',
  'trending-posts',
  'following-feed',
  'tag-posts',
  'post-interactions',
]);

export function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey[0];
        return typeof k === 'string' && POST_KEYS.has(k);
      },
    });
  }, [queryClient]);
}
