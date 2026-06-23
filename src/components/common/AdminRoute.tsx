import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionContext } from '@/context/SessionContext';

/**
 * AdminRoute hides admin UI from non-admins. It is a convenience only — every
 * admin API endpoint independently enforces the admin role server-side
 * (see requireAdmin), so bypassing this guard grants no access.
 */
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useSessionContext();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== 'admin') return <Navigate to="/feed" replace />;
  return <>{children}</>;
};

export default AdminRoute;
