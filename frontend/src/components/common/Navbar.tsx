// ============================================================
// Top Navigation Bar
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { notificationService } from '@/services/notificationService';
import { Bell, LogOut, User as UserIcon, Menu as MenuIcon, X, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { UserRole } from '@/types';

interface NavbarProps {
  onMobileToggle?: () => void;
  isMobileOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileToggle, isMobileOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadUnread = () => {
    setUnreadCount(notificationService.getUnreadCount());
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.STUDENT:
        return 'secondary';
      case UserRole.VENDOR:
        return 'warning';
      case UserRole.ADMIN:
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileToggle}
          className="p-2 rounded-lg text-text-secondary hover:bg-lavender md:hidden"
          aria-label="Toggle menu"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-primary">MessMate</span>
            <span className="hidden text-xs text-text-secondary sm:inline-block ml-2 font-medium">
              IIIT Dharwad
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {user?.role === UserRole.STUDENT && (
          <Link
            to="/student/notifications"
            className="relative p-2 rounded-lg text-text-secondary hover:bg-lavender transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-3 border-l border-border pl-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-text-primary leading-tight">
                {user.displayName}
              </span>
              <div className="mt-0.5">
                <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] py-0 px-1.5">
                  {user.role}
                </Badge>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-text-secondary hover:text-error hover:bg-error-light"
              title="Log out"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
