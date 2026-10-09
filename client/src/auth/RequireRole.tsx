import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole } from '../types';

export function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-slate-500">Loading session…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.user.role)) return <Navigate to={homeForRole(session.user.role)} replace />;
  return <>{children}</>;
}

export function homeForRole(role: UserRole) {
  if ([UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER].includes(role)) return '/reports';
  if (role === UserRole.DISTRICT_OFFICER || role === UserRole.RESCUE_TEAM) return '/rescue';
  if (role === UserRole.SHELTER_COORDINATOR || role === UserRole.RESOURCE_ORGANIZATION) return '/shelter';
  return '/reports';
}

export function UserHome() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-slate-500">Loading session…</div>;
  return <Navigate to={session ? homeForRole(session.user.role) : '/login'} replace />;
}