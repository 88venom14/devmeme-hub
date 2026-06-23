import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const useAdminUsers = (q?: string) =>
  useQuery({
    queryKey: ['admin-users', q ?? ''],
    queryFn: () => api.adminListUsers(q),
    placeholderData: (prev) => prev, // keep previous results visible while typing
  });

// Grant or revoke the moderator role (главный админ only).
export const useSetUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'moderator' }) =>
      api.adminSetUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};

export const useBanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, durationDays }: { id: string; reason: string; durationDays?: number }) =>
      api.adminBanUser(id, reason, durationDays ?? 0),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};

export const useUnbanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminUnbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};
