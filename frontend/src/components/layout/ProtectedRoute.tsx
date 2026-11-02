// ============================================================
// Protected Route Guard
// ============================================================

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Restoring session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the user's appropriate default dashboard
    if (user.role === UserRole.STUDENT) return <Navigate to="/student" replace />;
    if (user.role === UserRole.VENDOR) return <Navigate to="/vendor" replace />;
    if (user.role === UserRole.ADMIN) return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
