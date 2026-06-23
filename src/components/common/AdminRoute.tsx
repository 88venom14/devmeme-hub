import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionContext } from '@/context/SessionContext';

/**
 * AdminRoute hides admin UI from users without one of the allowed roles. It is a
 * convenience only — every admin API endpoint independently enforces the role
 * server-side (see requireAdmin/requireModerator), so bypassing this guard
 * grants no access. Defaults to admin-only; pass `roles` to also admit
 * moderators (e.g. the user-moderation tab).
 */
const AdminRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles = ['admin'] }) => {
  const session = useSessionContext();
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.user.role ?? '')) return <Navigate to="/feed" replace />;
  return <>{children}</>;
};

export default AdminRoute;
