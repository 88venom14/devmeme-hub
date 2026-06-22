import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useInvalidatePosts } from './useInvalidatePosts';

export const useAdminPosts = (q?: string) =>
  useQuery({
    queryKey: ['admin-posts', q ?? ''],
    queryFn: () => api.adminListPosts({ limit: 100, q }),
    placeholderData: (prev) => prev, // keep previous results visible while typing
  });

// Deletes any user's post (admin). Invalidates the admin list and every public
// post list so the removed post disappears everywhere.
export const useAdminDeletePost = () => {
  const qc = useQueryClient();
  const invalidatePosts = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.adminDeletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-posts'] });
      invalidatePosts();
    },
  });
};
