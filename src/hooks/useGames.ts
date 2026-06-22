import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type GameUploadInput } from '../lib/api';
import type { GameStatus } from '../types';

// Centralised cache invalidation so a moderation/author action refreshes every
// list that might contain the affected game.
function useInvalidateGames() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['games'] });
    qc.invalidateQueries({ queryKey: ['my-games'] });
    qc.invalidateQueries({ queryKey: ['admin-games'] });
    qc.invalidateQueries({ queryKey: ['game'] });
  };
}

export const useGames = (params: { q?: string; tag?: string } = {}) =>
  useQuery({
    queryKey: ['games', params],
    queryFn: () => api.listGames(params),
  });

export const useGame = (slug: string | undefined) =>
  useQuery({
    queryKey: ['game', slug],
    enabled: !!slug,
    queryFn: () => api.getGame(slug as string),
  });

export const useMyGames = () =>
  useQuery({
    queryKey: ['my-games'],
    queryFn: api.listMyGames,
  });

export const useUploadGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (input: GameUploadInput) => api.uploadGame(input),
    onSuccess: invalidate,
  });
};

export const useUpdateGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: GameUploadInput }) => api.updateGame(slug, input),
    onSuccess: invalidate,
  });
};

export const useDeleteGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (slug: string) => api.deleteGame(slug),
    onSuccess: invalidate,
  });
};

export const useAdminGames = (status?: GameStatus) =>
  useQuery({
    queryKey: ['admin-games', status ?? 'all'],
    queryFn: () => api.adminListGames(status),
  });

export const useApproveGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (slug: string) => api.approveGame(slug),
    onSuccess: invalidate,
  });
};

export const useRejectGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ slug, reason }: { slug: string; reason: string }) => api.rejectGame(slug, reason),
    onSuccess: invalidate,
  });
};

export const useRemoveGame = () => {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ slug, reason }: { slug: string; reason?: string }) => api.removeGame(slug, reason),
    onSuccess: invalidate,
  });
};

export const useGameModerationLog = (slug: string | undefined) =>
  useQuery({
    queryKey: ['game-moderation-log', slug],
    enabled: !!slug,
    queryFn: () => api.gameModerationLog(slug as string),
  });
