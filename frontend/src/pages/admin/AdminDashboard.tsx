// ============================================================
// Administrator Dashboard
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportService } from '@/services/reportService';
import { DashboardSummary } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatTime, formatMealType } from '@/lib/utils';
import {
  Users,
  Utensils,
  CalendarDays,
  Clock,
  BarChart3,
  Settings,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    setSummary(reportService.getDashboardSummary());
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/15 via-lavender to-background border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" className="text-xs">
              System Administration
            </Badge>
            <span className="text-xs text-text-secondary font-medium">
              Mess Committee &bull; IIIT Dharwad
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary">
            MessMate Management Hub
          </h2>
          <p className="text-xs md:text-sm text-text-secondary mt-1">
            Configure notification schedules, publish verified menu versions, manage accounts, and inspect demand analytics.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/admin/menu">
            <Button variant="default" size="sm" className="gap-1.5 text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Edit Menu</span>
            </Button>
          </Link>
          <Link to="/admin/schedules">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Schedules (28)</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Students */}
        <Card className="p-4 border-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="font-semibold">Registered Students</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-black text-text-primary mt-2">
            {summary?.totalStudents ?? 0}
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            Active eligible students
          </span>
        </Card>

        {/* Vendors */}
        <Card className="p-4 border-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="font-semibold">Mess Vendors</span>
            <Utensils className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-black text-text-primary mt-2">
            {summary?.totalVendors ?? 1}
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            Kitchen operating units
          </span>
        </Card>

        {/* Notification Schedules */}
        <Card className="p-4 border-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="font-semibold">Active Schedules</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-black text-text-primary mt-2">
            {summary?.configuredSchedules ?? 28}
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            28 Day/Meal slots configured
          </span>
        </Card>

        {/* Menu Version */}
        <Card className="p-4 border-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="font-semibold">Published Menu</span>
            <ShieldCheck className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-black text-success mt-2">
            v{summary?.publishedMenuVersion ?? 1}
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            Immutable version live
          </span>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Management */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="w-8 h-8 rounded-lg bg-lavender flex items-center justify-center text-primary mb-2">
              <Users className="w-4 h-4" />
            </div>
            <CardTitle className="text-base">User Management</CardTitle>
            <CardDescription className="text-xs">
              Manage student, vendor, and administrator demo accounts and access permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/admin/users">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Manage Users
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Menu Management */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="w-8 h-8 rounded-lg bg-lavender flex items-center justify-center text-primary mb-2">
              <CalendarDays className="w-4 h-4" />
            </div>
            <CardTitle className="text-base">Menu Draft & Publishing</CardTitle>
            <CardDescription className="text-xs">
              Edit dishes, manage alternating-week alternatives, and publish versioned menus.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/admin/menu">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Menu Management
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Notification Schedules */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="w-8 h-8 rounded-lg bg-lavender flex items-center justify-center text-primary mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <CardTitle className="text-base">Notification Schedules</CardTitle>
            <CardDescription className="text-xs">
              Configure 28 meal reminder schedules, evaluate lead times, and manage window overlaps.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/admin/schedules">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Configure Schedules
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines Widget */}
      <Card>
        <CardHeader className="pb-3 border-b border-border-light flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Upcoming Response Deadlines</CardTitle>
            <CardDescription className="text-xs">
              Monitor active student response windows across the schedule
            </CardDescription>
          </div>
          <Link to="/admin/schedules" className="text-xs text-primary font-medium hover:underline">
            View all 28 schedules
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border-light">
            {summary?.upcomingDeadlines.map((meal) => (
              <div
                key={meal.id}
                className="p-4 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-text-primary text-sm">
                    {formatMealType(meal.mealType)} — {formatDate(meal.mealDate)}
                  </span>
                  <div className="text-text-secondary text-[11px] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>Closes at {formatTime(meal.responseDeadline)} ({formatDate(meal.responseDeadline)})</span>
                  </div>
                </div>
                <Badge
                  variant={meal.status === 'RESPONSE_OPEN' ? 'warning' : 'outline'}
                  className="text-[11px]"
                >
                  {meal.status === 'RESPONSE_OPEN' ? 'Open for Responses' : meal.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
