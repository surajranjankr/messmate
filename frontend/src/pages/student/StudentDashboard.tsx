// ============================================================
// Student Dashboard
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { mealInstanceService } from '@/services/mealInstanceService';
import { menuService } from '@/services/menuService';
import { responseService } from '@/services/responseService';
import { notificationService } from '@/services/notificationService';
import {
  MealInstance,
  MealInstanceStatus,
  MealType,
  ResponseChoice,
  Notification,
  MealResponse,
} from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  formatTime,
  formatMealType,
  formatResponseChoice,
  getDayOfWeekFromDate,
} from '@/lib/utils';
import { getCurrentTime } from '@/lib/clock';
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Bell,
  ArrowRight,
  History,
  Sparkles,
} from 'lucide-react';
import { parseISO, format } from 'date-fns';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [actionableMeal, setActionableMeal] = useState<MealInstance | null>(null);
  const [todaysMeals, setTodaysMeals] = useState<MealInstance[]>([]);
  const [userResponses, setUserResponses] = useState<Record<string, MealResponse | null>>({});
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [recentHistory, setRecentHistory] = useState<MealResponse[]>([]);

  const loadData = () => {
    if (!user) return;

    const nextMeal = mealInstanceService.getNextActionableMeal();
    setActionableMeal(nextMeal);

    const todayMeals = mealInstanceService.getTodaysMeals();
    setTodaysMeals(todayMeals);

    // Fetch user's responses for today's meals and next meal
    const responsesMap: Record<string, MealResponse | null> = {};
    if (nextMeal) {
      responsesMap[nextMeal.id] = responseService.getMyResponse(user.id, nextMeal.id);
    }
    todayMeals.forEach((m) => {
      responsesMap[m.id] = responseService.getMyResponse(user.id, m.id);
    });
    setUserResponses(responsesMap);

    // Notifications
    setRecentNotifications(notificationService.getNotifications().slice(0, 3));

    // Response history
    setRecentHistory(responseService.getMyHistory(user.id).slice(0, 4));
  };

  useEffect(() => {
    loadData();

    // Listen for time changes from the ClockDebugger
    const handleClockTick = () => loadData();
    window.addEventListener('clock-tick', handleClockTick);
    return () => window.removeEventListener('clock-tick', handleClockTick);
  }, [user]);

  const now = getCurrentTime();

  const getStatusBadge = (instance: MealInstance, userResponse: MealResponse | null) => {
    if (userResponse) {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>Responded: {formatResponseChoice(userResponse.choice)}</span>
        </Badge>
      );
    }
    if (instance.status === MealInstanceStatus.RESPONSE_OPEN) {
      return (
        <Badge variant="warning" className="gap-1 animate-pulse">
          <Clock className="w-3 h-3" />
          <span>Response Required</span>
        </Badge>
      );
    }
    if (instance.status === MealInstanceStatus.RESPONSE_CLOSED) {
      return (
        <Badge variant="error" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>Deadline Passed</span>
        </Badge>
      );
    }
    if (instance.status === MealInstanceStatus.COMPLETED) {
      return <Badge variant="muted">Meal Completed</Badge>;
    }
    return <Badge variant="outline">Upcoming</Badge>;
  };

  // Menu preview helper
  const getMenuSummary = (instance: MealInstance) => {
    const mealDate = parseISO(instance.mealDate);
    const dayOfWeek = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(dayOfWeek, instance.mealType, instance.menuVersionId);
    if (!entry || entry.dishes.length === 0) return 'Menu details available on menu page';
    return entry.dishes.map((d) => d.name).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-lavender to-background border border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Welcome, {user?.displayName}! 👋
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {format(now, 'EEEE, MMMM d, yyyy')} &bull; IIIT Dharwad Mess 1
          </p>
        </div>
        <Link to="/student/menu">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="w-4 h-4" />
            <span>View Full Menu</span>
          </Button>
        </Link>
      </div>

      {/* Featured / Actionable Meal Card */}
      {actionableMeal && (
        <Card className="border-primary/30 shadow-md bg-gradient-to-br from-card to-lavender/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold text-xs">
                  NEXT MEAL REQUIRING ATTENTION
                </Badge>
                {getStatusBadge(actionableMeal, userResponses[actionableMeal.id] ?? null)}
              </div>
              <div className="flex items-center gap-1 text-xs text-text-secondary font-medium">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Deadline: {formatTime(actionableMeal.responseDeadline)} ({formatDate(actionableMeal.responseDeadline)})</span>
              </div>
            </div>
            <CardTitle className="text-2xl mt-2 text-primary">
              {formatMealType(actionableMeal.mealType)} — {formatDate(actionableMeal.mealDate)}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Planned Dishes:
              </span>
              <p className="text-sm font-medium text-text-primary mt-1">
                {getMenuSummary(actionableMeal)}
              </p>
            </div>

            {userResponses[actionableMeal.id] && (
              <div className="p-3 bg-success-light/60 border border-success/20 rounded-lg flex items-center justify-between text-xs">
                <span className="text-success font-medium">
                  Your current choice: <strong>{formatResponseChoice(userResponses[actionableMeal.id]!.choice)}</strong>
                </span>
                <span className="text-text-secondary">
                  Last updated: {formatTime(userResponses[actionableMeal.id]!.updatedAt)}
                </span>
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-0 flex flex-wrap items-center justify-between gap-3">
            <Link to={`/student/meals/${actionableMeal.id}`}>
              <Button
                variant={userResponses[actionableMeal.id] ? 'outline' : 'default'}
                className="gap-2"
              >
                <Utensils className="w-4 h-4" />
                <span>
                  {userResponses[actionableMeal.id] ? 'Change Intention' : 'Respond Now'}
                </span>
              </Button>
            </Link>
            <p className="text-xs text-text-secondary">
              Responses help the mess vendor prepare exact quantities and avoid wastage.
            </p>
          </CardFooter>
        </Card>
      )}

      {/* Today's Meals Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" />
            <span>Today's Meal Schedule</span>
          </h3>
          <Link to="/student/meals" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            <span>All upcoming meals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {todaysMeals.length === 0 ? (
          <Card className="p-6 text-center text-text-secondary text-sm">
            No scheduled meals found for today in the demo dataset.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {todaysMeals.map((meal) => {
              const resp = userResponses[meal.id] ?? null;
              return (
                <Card key={meal.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-primary uppercase">
                        {formatMealType(meal.mealType)}
                      </span>
                      {getStatusBadge(meal, resp)}
                    </div>
                    <CardTitle className="text-base">
                      {formatMealType(meal.mealType)}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="text-xs space-y-2 flex-1">
                    <p className="text-text-secondary line-clamp-2">
                      {getMenuSummary(meal)}
                    </p>
                    <div className="text-[11px] text-text-secondary flex items-center gap-1 pt-1 border-t border-border-light">
                      <Clock className="w-3 h-3 text-text-secondary" />
                      <span>Closes: {formatTime(meal.responseDeadline)}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2">
                    <Link to={`/student/meals/${meal.id}`} className="w-full">
                      <Button variant="secondary" size="sm" className="w-full text-xs">
                        {resp ? 'View / Edit' : 'Submit Intention'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Split Section: Notifications & Recent History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span>Notifications</span>
            </CardTitle>
            <Link to="/student/notifications" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">No notifications yet.</p>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-lg border border-border-light bg-card hover:bg-lavender/30 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-text-primary">{notif.title}</h5>
                    <span className="text-[10px] text-text-secondary">{formatTime(notif.createdAt)}</span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{notif.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Responses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>Your Response History</span>
            </CardTitle>
            <Link to="/student/history" className="text-xs text-primary hover:underline">
              Full history
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentHistory.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">
                No past meal responses recorded yet.
              </p>
            ) : (
              recentHistory.map((hist) => (
                <div
                  key={hist.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border-light text-xs"
                >
                  <div>
                    <div className="font-semibold text-text-primary">
                      {hist.mealInstanceId.replace('mi-', '').toUpperCase()}
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Updated: {formatTime(hist.updatedAt)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">
                    {formatResponseChoice(hist.choice)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
