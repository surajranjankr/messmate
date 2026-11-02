// ============================================================
// Student Meal List Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { mealInstanceService } from '@/services/mealInstanceService';
import { menuService } from '@/services/menuService';
import { responseService } from '@/services/responseService';
import { MealInstance, MealResponse, MealInstanceStatus } from '@/types';
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
import { Utensils, Clock, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { parseISO } from 'date-fns';

export const MealListPage: React.FC = () => {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealInstance[]>([]);
  const [responses, setResponses] = useState<Record<string, MealResponse | null>>({});
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadMeals = () => {
    if (!user) return;
    const all = mealInstanceService.getAllMealInstances();
    // Sort chronological
    all.sort((a, b) => parseISO(a.mealDate).getTime() - parseISO(b.mealDate).getTime());
    setMeals(all);

    const respMap: Record<string, MealResponse | null> = {};
    all.forEach((m) => {
      respMap[m.id] = responseService.getMyResponse(user.id, m.id);
    });
    setResponses(respMap);
  };

  useEffect(() => {
    loadMeals();
    const handleClockTick = () => loadMeals();
    window.addEventListener('clock-tick', handleClockTick);
    return () => window.removeEventListener('clock-tick', handleClockTick);
  }, [user]);

  const filteredMeals = meals.filter((m) => {
    if (statusFilter === 'OPEN') return m.status === MealInstanceStatus.RESPONSE_OPEN;
    if (statusFilter === 'CLOSED') return m.status === MealInstanceStatus.RESPONSE_CLOSED;
    if (statusFilter === 'RESPONDED') return responses[m.id] !== null && responses[m.id] !== undefined;
    if (statusFilter === 'PENDING') return !responses[m.id] && m.status === MealInstanceStatus.RESPONSE_OPEN;
    return true;
  });

  const getMenuSummary = (instance: MealInstance) => {
    const mealDate = parseISO(instance.mealDate);
    const dayOfWeek = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(dayOfWeek, instance.mealType, instance.menuVersionId);
    if (!entry || entry.dishes.length === 0) return 'Menu available';
    return entry.dishes.map((d) => d.name).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Meal Intention Schedule
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Select an upcoming meal to view dishes and communicate your attendance
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'ALL', label: 'All Meals' },
            { id: 'OPEN', label: 'Response Open' },
            { id: 'PENDING', label: 'Needs Your Response' },
            { id: 'RESPONDED', label: 'Responded' },
          ].map((f) => (
            <Button
              key={f.id}
              variant={statusFilter === f.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(f.id)}
              className="text-xs h-8"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMeals.map((meal) => {
          const resp = responses[meal.id];
          const isOpen = meal.status === MealInstanceStatus.RESPONSE_OPEN;

          return (
            <Card key={meal.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {formatMealType(meal.mealType)}
                  </span>
                  {resp ? (
                    <Badge variant="success" className="text-[11px]">
                      {formatResponseChoice(resp.choice)}
                    </Badge>
                  ) : isOpen ? (
                    <Badge variant="warning" className="text-[11px]">
                      Response Open
                    </Badge>
                  ) : (
                    <Badge variant="muted" className="text-[11px]">
                      Closed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-1">
                  {formatDate(meal.mealDate)}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 text-xs flex-1">
                <p className="text-text-secondary line-clamp-3">
                  {getMenuSummary(meal)}
                </p>

                <div className="pt-2 border-t border-border-light space-y-1 text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Deadline:</span>
                    <span className="font-medium text-text-primary">
                      {formatTime(meal.responseDeadline)} ({formatDate(meal.responseDeadline)})
                    </span>
                  </div>
                  {resp && (
                    <div className="flex items-center justify-between text-success">
                      <span>Submitted:</span>
                      <span>{formatTime(resp.updatedAt)}</span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-2">
                <Link to={`/student/meals/${meal.id}`} className="w-full">
                  <Button
                    variant={resp ? 'outline' : isOpen ? 'default' : 'secondary'}
                    size="sm"
                    className="w-full"
                  >
                    {isOpen
                      ? resp
                        ? 'Change Response'
                        : 'Submit Response'
                      : 'View Meal & Status'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
