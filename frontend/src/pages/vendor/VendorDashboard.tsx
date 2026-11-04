// ============================================================
// Mess Vendor Dashboard
// ============================================================
// Designed around the primary operational question:
// "How much food should we prepare?"

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { mealInstanceService } from '@/services/mealInstanceService';
import { menuService } from '@/services/menuService';
import { responseService } from '@/services/responseService';
import { forecastService } from '@/services/forecastService';
import {
  MealInstance,
  MealInstanceStatus,
  MealCounts,
  ForecastRecommendation,
  VendorDecision,
  VendorDecisionStatus,
} from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  formatTime,
  formatMealType,
  getDayOfWeekFromDate,
  isBeforeDeadline,
} from '@/lib/utils';
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Users,
  PieChart,
} from 'lucide-react';
import { parseISO } from 'date-fns';

export const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [todaysMeals, setTodaysMeals] = useState<MealInstance[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, MealCounts>>({});
  const [recsMap, setRecsMap] = useState<Record<string, ForecastRecommendation>>({});
  const [decisionsMap, setDecisionsMap] = useState<Record<string, VendorDecision | null>>({});

  const loadVendorData = () => {
    const meals = mealInstanceService.getTodaysMeals();
    setTodaysMeals(meals);

    const counts: Record<string, MealCounts> = {};
    const recs: Record<string, ForecastRecommendation> = {};
    const decisions: Record<string, VendorDecision | null> = {};

    meals.forEach((m) => {
      counts[m.id] = responseService.getAggregateCounts(m.id);
      recs[m.id] = forecastService.getRecommendation(m.id);
      decisions[m.id] = forecastService.getVendorDecision(m.id);
    });

    setCountsMap(counts);
    setRecsMap(recs);
    setDecisionsMap(decisions);

    // Asynchronously synchronize with backend
    meals.forEach(async (m) => {
      try {
        const [c, r, d] = await Promise.all([
          responseService.fetchAggregateCounts(m.id),
          forecastService.fetchRecommendation(m.id),
          forecastService.fetchVendorDecision(m.id),
        ]);
        if (c) {
          const localTotal = (counts[m.id]?.definitelyEating ?? 0) + (counts[m.id]?.probablyEating ?? 0) + (counts[m.id]?.notEating ?? 0);
          const backendTotal = c.definitelyEating + c.probablyEating + c.notEating;
          if (backendTotal > 0 || localTotal === 0) {
            setCountsMap((prev) => ({ ...prev, [m.id]: c }));
          }
        }
        if (r) setRecsMap((prev) => ({ ...prev, [m.id]: r }));
        if (d !== undefined) setDecisionsMap((prev) => ({ ...prev, [m.id]: d }));
      } catch {
        // Fallback kept
      }
    });
  };

  useEffect(() => {
    loadVendorData();

    // Auto-refresh live student response counts across all meals every 4 seconds
    const pollInterval = setInterval(() => {
      loadVendorData();
    }, 4000);

    const handleClockTick = () => loadVendorData();
    const handleResponseUpdate = () => loadVendorData();

    window.addEventListener('clock-tick', handleClockTick);
    window.addEventListener('response-updated', handleResponseUpdate);
    window.addEventListener('storage', handleResponseUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('clock-tick', handleClockTick);
      window.removeEventListener('response-updated', handleResponseUpdate);
      window.removeEventListener('storage', handleResponseUpdate);
    };
  }, []);

  const getMenuSummary = (instance: MealInstance) => {
    const mealDate = parseISO(instance.mealDate);
    const dayOfWeek = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(dayOfWeek, instance.mealType, instance.menuVersionId);
    if (!entry) return 'Menu available';
    return entry.dishes.map((d) => d.name).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-warning-light/60 via-lavender to-background border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" className="font-semibold text-xs">
              Kitchen Preparation Overview
            </Badge>
            <span className="text-xs text-text-secondary">
              IIIT Dharwad Mess 1 &bull; {user?.displayName}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary">
            How much food should we prepare today?
          </h2>
          <p className="text-xs md:text-sm text-text-secondary mt-1">
            Review final response counts once deadlines close, inspect preparation recommendations, and confirm kitchen batch quantities.
          </p>
        </div>

        <Link to="/vendor/planning" className="shrink-0">
          <Button variant="default" size="lg" className="gap-2">
            <span>Kitchen Planning Sheet</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Dynamic Forecast Notice */}
      <div className="p-3 bg-lavender/50 border border-border-light rounded-xl flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Dynamic Demand Forecasting:</strong> Attendance and preparation recommendations are dynamically calculated from active student population, real-time responses, and historical nonresponse rates.
          </span>
        </div>
      </div>

      {/* Today's 4 Meal Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          <span>Today's Meal Preparation Cards</span>
        </h3>

        {todaysMeals.length === 0 ? (
          <Card className="p-8 text-center text-text-secondary">
            No scheduled meals found for today.
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {todaysMeals.map((meal) => {
              const isPastDeadline = !isBeforeDeadline(meal.responseDeadline);
              const counts = countsMap[meal.id];
              const rec = recsMap[meal.id];
              const decision = decisionsMap[meal.id];
              const isConfirmed = !!decision;

              return (
                <Card
                  key={meal.id}
                  className={`border-2 transition-all ${
                    isConfirmed
                      ? 'border-success/40 bg-card shadow-xs'
                      : isPastDeadline
                      ? 'border-warning/60 bg-card shadow-md'
                      : 'border-border bg-card'
                  }`}
                >
                  <CardHeader className="pb-3 border-b border-border-light bg-lavender/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary uppercase">
                          {formatMealType(meal.mealType)}
                        </span>
                        {isConfirmed ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Plan Confirmed</span>
                          </Badge>
                        ) : isPastDeadline ? (
                          <Badge variant="warning" className="gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Final Counts Ready</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline">Response Window Open</Badge>
                        )}
                      </div>

                      <div className="text-xs text-text-secondary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Deadline: {formatTime(meal.responseDeadline)}</span>
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-1">
                      {formatMealType(meal.mealType)} &bull; {formatDate(meal.mealDate)}
                    </CardTitle>
                    <p className="text-xs text-text-secondary line-clamp-1">
                      {getMenuSummary(meal)}
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Response Counts Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <span>{isPastDeadline ? 'Final Student Response Counts' : 'Live Student Response Counts'}</span>
                          {!isPastDeadline && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                          )}
                        </span>
                        {!isPastDeadline && (
                          <span className="text-[11px] text-success font-semibold">
                            (Updating live)
                          </span>
                        )}
                      </div>

                      {counts ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {/* Definitely */}
                          <div className="p-2.5 rounded-lg bg-success-light/50 border border-success/20">
                            <div className="text-lg font-extrabold text-success">
                              {counts.definitelyEating}
                            </div>
                            <div className="text-[10px] font-semibold text-text-secondary uppercase">
                              Definitely
                            </div>
                          </div>

                          {/* Probably */}
                          <div className="p-2.5 rounded-lg bg-warning-light/50 border border-warning/20">
                            <div className="text-lg font-extrabold text-warning">
                              {counts.probablyEating}
                            </div>
                            <div className="text-[10px] font-semibold text-text-secondary uppercase">
                              Probably
                            </div>
                          </div>

                          {/* Not Eating */}
                          <div className="p-2.5 rounded-lg bg-error-light/50 border border-error/20">
                            <div className="text-lg font-extrabold text-error">
                              {counts.notEating}
                            </div>
                            <div className="text-[10px] font-semibold text-text-secondary uppercase">
                              Not Eating
                            </div>
                          </div>

                          {/* No Response — CRITICAL SEPARATE CATEGORY */}
                          <div className="p-2.5 rounded-lg bg-lavender/50 border border-border">
                            <div className="text-lg font-extrabold text-text-primary">
                              {counts.noResponse}
                            </div>
                            <div className="text-[10px] font-semibold text-text-secondary uppercase">
                              No Response
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-secondary">Loading counts...</p>
                      )}

                      <div className="text-[11px] text-text-secondary mt-1.5 flex justify-between">
                        <span>Total Registered Students: {counts?.totalRegistered ?? 0}</span>
                        <span className="italic">No Response is strictly separated from Not Eating</span>
                      </div>
                    </div>

                    {/* Recommendation Box */}
                    {rec && (
                      <div className="p-3.5 rounded-xl bg-lavender/40 border border-primary/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Recommended Preparation</span>
                          </span>
                          <Badge variant="muted" className="text-[10px]">
                            {Math.round(rec.safetyMarginFraction * 100)}% Margin
                          </Badge>
                        </div>

                        {rec.dataQualityStatus === 'INSUFFICIENT' ? (
                          <div className="p-2.5 rounded-lg bg-warning-light/50 border border-warning/30 text-warning-dark text-xs space-y-1">
                            <div className="font-semibold flex items-center gap-1 text-warning">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Manual Preparation Required</span>
                            </div>
                            <p className="text-[11px] text-text-secondary">
                              Insufficient response history to generate a reliable preparation recommendation. Please enter a manual preparation quantity.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-primary">
                              {rec.recommendedPortions ?? 0}
                            </span>
                            <span className="text-xs text-text-secondary font-medium">
                              Portions recommended (Expected demand {rec.expectedAttendance} + {Math.round(rec.safetyMarginFraction * 100)}% safety margin)
                            </span>
                          </div>
                        )}

                        {decision && (
                          <div className="pt-2 border-t border-primary/10 flex items-center justify-between text-xs">
                            <span className="text-success font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Vendor Confirmed: {decision.finalPlannedQuantity} portions</span>
                            </span>
                            {decision.status === VendorDecisionStatus.OVERRIDDEN && (
                              <Badge variant="warning" className="text-[10px]">
                                Custom Override
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 flex items-center justify-between gap-3">
                    <Link to={`/vendor/planning?mealId=${meal.id}`} className="w-full">
                      <Button
                        variant={isConfirmed ? 'outline' : 'default'}
                        className="w-full text-xs font-semibold"
                      >
                        {isConfirmed ? 'Edit Planned Quantity' : 'Review & Confirm Batch Quantity'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
