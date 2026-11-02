// ============================================================
// Role-Based Navigation Sidebar
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Utensils,
  CalendarDays,
  History,
  Bell,
  UserCheck,
  ClipboardList,
  CheckCircle2,
  BarChart3,
  Users,
  Settings,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  if (!user) return null;

  const studentLinks = [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/meals', label: 'Meal Responses', icon: Utensils },
    { to: '/student/menu', label: 'Weekly Menu', icon: CalendarDays },
    { to: '/student/history', label: 'My Response History', icon: History },
    { to: '/student/notifications', label: 'Notifications', icon: Bell },
    { to: '/student/profile', label: 'Profile & Preferences', icon: UserCheck },
  ];

  const vendorLinks = [
    { to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/vendor/planning', label: 'Meal Planning', icon: ClipboardList },
    { to: '/vendor/outcomes', label: 'Record Outcomes', icon: CheckCircle2 },
    { to: '/vendor/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/vendor/profile', label: 'Vendor Profile', icon: UserCheck },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/menu', label: 'Menu Management', icon: CalendarDays },
    { to: '/admin/schedules', label: 'Notification Schedules', icon: Clock },
    { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/admin/settings', label: 'System Settings', icon: Settings },
  ];

  let links = studentLinks;
  if (user.role === UserRole.VENDOR) links = vendorLinks;
  if (user.role === UserRole.ADMIN) links = adminLinks;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card p-4 transition-transform duration-200 md:static md:translate-x-0 pt-20 md:pt-4 flex flex-col justify-between',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="space-y-1">
          <div className="px-3 py-2 text-xs font-semibold tracking-wider text-text-secondary uppercase">
            {user.role} PORTAL
          </div>

          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-lavender text-primary font-semibold'
                        : 'text-text-secondary hover:bg-lavender/50 hover:text-text-primary'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Prototype notice pill */}
        <div className="mt-auto pt-4 border-t border-border-light">
          <div className="rounded-lg bg-lavender/60 p-3 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase 1 Prototype</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Browser-local demo persistence. Backend integration in Phase 2.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
