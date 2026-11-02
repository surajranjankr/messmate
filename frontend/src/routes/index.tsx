// ============================================================
// Application Routing Configuration
// ============================================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@/types';

// Layouts & Guards
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

// Public Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Student Pages
import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { MealListPage } from '@/pages/student/MealListPage';
import { MealResponsePage } from '@/pages/student/MealResponsePage';
import { WeeklyMenuPage } from '@/pages/student/WeeklyMenuPage';
import { NotificationsPage } from '@/pages/student/NotificationsPage';
import { ResponseHistoryPage } from '@/pages/student/ResponseHistoryPage';
import { StudentProfilePage } from '@/pages/student/StudentProfilePage';

// Vendor Pages
import { VendorDashboard } from '@/pages/vendor/VendorDashboard';
import { VendorPlanningPage } from '@/pages/vendor/VendorPlanningPage';
import { VendorOutcomesPage } from '@/pages/vendor/VendorOutcomesPage';
import { VendorReportsPage } from '@/pages/vendor/VendorReportsPage';
import { VendorProfilePage } from '@/pages/vendor/VendorProfilePage';

// Admin Pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';
import { MenuManagementPage } from '@/pages/admin/MenuManagementPage';
import { ScheduleManagementPage } from '@/pages/admin/ScheduleManagementPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';

// Root Redirect Component
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === UserRole.STUDENT) return <Navigate to="/student" replace />;
  if (user.role === UserRole.VENDOR) return <Navigate to="/vendor" replace />;
  if (user.role === UserRole.ADMIN) return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Student Portal Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[UserRole.STUDENT]} />}>
        <Route element={<AppLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/meals" element={<MealListPage />} />
          <Route path="/student/meals/:mealId" element={<MealResponsePage />} />
          <Route path="/student/menu" element={<WeeklyMenuPage />} />
          <Route path="/student/notifications" element={<NotificationsPage />} />
          <Route path="/student/history" element={<ResponseHistoryPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
        </Route>
      </Route>

      {/* Vendor Portal Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[UserRole.VENDOR]} />}>
        <Route element={<AppLayout />}>
          <Route path="/vendor" element={<VendorDashboard />} />
          <Route path="/vendor/planning" element={<VendorPlanningPage />} />
          <Route path="/vendor/meals/:mealId" element={<VendorPlanningPage />} />
          <Route path="/vendor/outcomes" element={<VendorOutcomesPage />} />
          <Route path="/vendor/reports" element={<VendorReportsPage />} />
          <Route path="/vendor/profile" element={<VendorProfilePage />} />
        </Route>
      </Route>

      {/* Admin Portal Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/menu" element={<MenuManagementPage />} />
          <Route path="/admin/menu/:menuId" element={<MenuManagementPage />} />
          <Route path="/admin/schedules" element={<ScheduleManagementPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
