// ============================================================
// Vendor Meal Planning Page
// ============================================================
// Simple, non-technical planning sheet for mess kitchen staff.
// Displays the incoming latest upcoming meal, student response counts,
// recommended portions, and the option to accept or adjust batch size.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mealInstanceService } from '@/services/mealInstanceService';
import { responseService } from '@/services/responseService';
import { forecastService } from '@/services/forecastService';
import { menuService } from '@/services/menuService';
import {
  MealInstance,
  MealCounts,
  ForecastRecommendation,
  VendorDecision,
  VendorDecisionStatus,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  formatTime,
  formatMealType,
  getDayOfWeekFromDate,
  isBeforeDeadline,
  isAfterOpeningTime,
} from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  ArrowLeft,
  Utensils,
  Clock,
  Sparkles,
} from 'lucide-react';
import { parseISO } from 'date-fns';

export const VendorPlanningPage: React.FC = () => {
  const [selectedMeal, setSelectedMeal] = useState<MealInstance | null>(null);
  const [counts, setCounts] = useState<MealCounts | null>(null);
  const [recommendation, setRecommendation] = useState<ForecastRecommendation | null>(null);
  const [existingDecision, setExistingDecision] = useState<VendorDecision | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form state
  const [plannedQty, setPlannedQty] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isOverrideMode, setIsOverrideMode] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadMealData = async (targetMeal: MealInstance, silent = false) => {
    if (!silent) setIsLoading(true);

    setSelectedMeal(targetMeal);

    // Immediate local cache
    const c = responseService.getAggregateCounts(targetMeal.id);
    setCounts(c);

    const rec = forecastService.getRecommendation(targetMeal.id);
    setRecommendation(rec);

    const decision = forecastService.getVendorDecision(targetMeal.id);
    setExistingDecision(decision);

    if (decision) {
      setPlannedQty(String(decision.finalPlannedQuantity));
      setOverrideReason(decision.overrideReason ?? '');
      setIsOverrideMode(decision.status === VendorDecisionStatus.OVERRIDDEN);
    } else if (rec.recommendedPortions != null) {
      setPlannedQty(String(rec.recommendedPortions));
      setOverrideReason('');
      setIsOverrideMode(false);
    }

    // Backend sync
    try {
      const [backendCount, backendRec, backendDecision] = await Promise.all([
        responseService.fetchAggregateCounts(targetMeal.id),
        forecastService.fetchRecommendation(targetMeal.id),
        forecastService.fetchVendorDecision(targetMeal.id),
      ]);

      if (backendCount) setCounts(backendCount);
      if (backendRec) {
        setRecommendation(backendRec);
        if (!backendDecision && backendRec.recommendedPortions != null) {
          setPlannedQty(String(backendRec.recommendedPortions));
        }
      }
      if (backendDecision) {
        setExistingDecision(backendDecision);
        setPlannedQty(String(backendDecision.finalPlannedQuantity));
        setOverrideReason(backendDecision.overrideReason ?? '');
        setIsOverrideMode(backendDecision.status === VendorDecisionStatus.OVERRIDDEN);
      }
    } catch {
      // Retain local counts
    } finally {
      setIsLoading(false);
    }
  };

  const loadIncomingMeal = async (silent = false) => {
    let targetMeal: MealInstance | null = null;
    targetMeal = await mealInstanceService.fetchActionableMealInstance();

    if (!targetMeal) {
      targetMeal = mealInstanceService.getNextActionableMeal();
    }

    if (targetMeal) {
      await loadMealData(targetMeal, silent);
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIncomingMeal();

    // Auto-refresh live counts for incoming meal every 4 seconds in background
    const pollInterval = setInterval(() => {
      loadIncomingMeal(true);
    }, 4000);

    const handleClockTick = () => loadIncomingMeal();
    window.addEventListener('clock-tick', handleClockTick);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('clock-tick', handleClockTick);
    };
  }, []);

  const handleAcceptRecommendation = () => {
    if (!recommendation || recommendation.recommendedPortions == null) return;
    setPlannedQty(String(recommendation.recommendedPortions));
    setIsOverrideMode(false);
    setOverrideReason('');
    setFormError(null);
  };

  const handleConfirmPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal) return;

    const parsedQty = Number(plannedQty);
    if (isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty < 0) {
      setFormError('Please enter a valid whole number of portions.');
      return;
    }

    try {
      const saved = forecastService.saveVendorDecision(
        selectedMeal.id,
        parsedQty,
        isOverrideMode ? overrideReason : undefined
      );
      setExistingDecision(saved);
      setSuccessMessage(`Kitchen preparation plan confirmed: ${saved.finalPlannedQuantity} portions.`);
      setFormError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save plan.';
      setFormError(msg);
    }
  };

  const getMenuDishes = (inst?: MealInstance | null): string[] => {
    if (!inst) return [];
    const mealDate = parseISO(inst.mealDate);
    const day = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(day, inst.mealType, inst.menuVersionId);
    if (!entry) return ['Standard menu'];
    return entry.dishes.map((d) => d.name);
  };

  if (isLoading && !selectedMeal) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            to="/vendor"
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Vendor Dashboard</span>
          </Link>
        </div>
        <Card className="p-12 text-center text-text-secondary">
          Loading incoming meal planning details...
        </Card>
      </div>
    );
  }

  if (!selectedMeal) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            to="/vendor"
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Vendor Dashboard</span>
          </Link>
        </div>
        <Card className="p-12 text-center space-y-3">
          <Utensils className="w-10 h-10 text-text-secondary mx-auto" />
          <h3 className="text-lg font-bold text-text-primary">No Incoming Meals Scheduled</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            All scheduled meals are completed. Upcoming meals will appear here as soon as scheduled.
          </p>
        </Card>
      </div>
    );
  }

  const isPastDeadline = !isBeforeDeadline(selectedMeal.responseDeadline);
  const isOpen = selectedMeal.responseOpenTime
    ? isAfterOpeningTime(selectedMeal.responseOpenTime) && !isPastDeadline
    : !isPastDeadline;
  const isUpcoming = selectedMeal.responseOpenTime
    ? !isAfterOpeningTime(selectedMeal.responseOpenTime)
    : false;

  const dishes = getMenuDishes(selectedMeal);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/vendor"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Vendor Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" className="font-semibold text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Incoming Meal</span>
            </Badge>
            <span className="text-xs text-text-secondary">
              IIIT Dharwad Mess 1
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Kitchen Preparation Planning
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Review student intentions, check recommended portions, and confirm kitchen preparation for the incoming meal.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 bg-success-light text-success border border-success/30 rounded-xl text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-2 p-4 bg-error-light text-error border border-error/30 rounded-xl text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Two Column Layout: Meal Details (Left) & Confirmation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Meal Info & Student Intentions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border-light bg-lavender/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {formatMealType(selectedMeal.mealType)}
                  </Badge>
                  {isPastDeadline ? (
                    <Badge variant="warning" className="text-xs">
                      Final Response Counts
                    </Badge>
                  ) : isOpen ? (
                    <Badge variant="success" className="text-xs">
                      Response Window Open
                    </Badge>
                  ) : isUpcoming ? (
                    <Badge variant="outline" className="text-xs">
                      Upcoming
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-text-secondary flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Deadline: {formatTime(selectedMeal.responseDeadline)}</span>
                </div>
              </div>
              <CardTitle className="text-xl mt-2">
                {formatMealType(selectedMeal.mealType)} &bull; {formatDate(selectedMeal.mealDate)}
              </CardTitle>
              <CardDescription>
                Menu: {dishes.join(', ')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Student Intentions Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Student Intentions Breakdown
                </h4>

                {counts && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-success-light/40 border border-success/20">
                      <div className="text-2xl font-black text-success">
                        {counts.definitelyEating}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1">
                        Definitely Eating
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-warning-light/40 border border-warning/20">
                      <div className="text-2xl font-black text-warning">
                        {counts.probablyEating}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1">
                        Probably Eating
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-error-light/40 border border-error/20">
                      <div className="text-2xl font-black text-error">
                        {counts.notEating}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1">
                        Not Eating
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-lavender/60 border border-border">
                      <div className="text-2xl font-black text-text-primary">
                        {counts.noResponse}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1">
                        No Response
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-lavender/40 border border-border-light rounded-xl mt-3 text-xs text-text-secondary flex items-center justify-between">
                  <span>Total Registered Students: <strong>{counts?.totalRegistered ?? 0}</strong></span>
                  <span className="italic">No Response is strictly separated from Not Eating.</span>
                </div>
              </div>

              {/* Simple Recommended Box */}
              {recommendation && (
                <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                      Recommended Preparation
                    </span>
                    <Badge variant="muted" className="text-[10px]">
                      {Math.round(recommendation.safetyMarginFraction * 100)}% Safety Margin
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-primary">
                      {recommendation.recommendedPortions ?? 0}
                    </span>
                    <span className="text-xs text-text-secondary font-medium">
                      Portions recommended (Expected demand: {recommendation.expectedAttendance} students + safety buffer)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Confirm Kitchen Batch / Adjust Quantity (1 col) */}
        <div className="space-y-6">
          <Card className="border-2 border-primary/30 shadow-md">
            <CardHeader className="bg-primary/5 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                <span>Confirm Kitchen Batch</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Accept the recommendation or enter a custom batch quantity
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleConfirmPlan} className="space-y-4">
                {/* Big Number Display */}
                <div className="p-4 rounded-xl bg-lavender/50 border border-primary/20 text-center space-y-1">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                    Target Batch Quantity
                  </span>
                  <div className="text-4xl font-black text-primary">
                    {plannedQty || '0'}
                  </div>
                  <span className="text-xs text-text-secondary font-medium">
                    Portions to prepare
                  </span>
                </div>

                {/* Accept Recommendation Button */}
                {recommendation && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAcceptRecommendation}
                    className="w-full text-xs font-semibold gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span>Use Recommended ({recommendation.recommendedPortions} portions)</span>
                  </Button>
                )}

                {/* Override Toggle / Input */}
                <div className="pt-2 border-t border-border-light space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="customQty" className="text-xs font-bold text-text-primary">
                      Custom Batch Override
                    </Label>
                    <button
                      type="button"
                      onClick={() => setIsOverrideMode(!isOverrideMode)}
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      {isOverrideMode ? 'Cancel Override' : 'Change Quantity'}
                    </button>
                  </div>

                  {isOverrideMode && (
                    <div className="space-y-3 p-3 bg-background rounded-lg border border-border">
                      <div className="space-y-1">
                        <Label htmlFor="plannedQuantity" className="text-xs">
                          New Quantity (Portions)
                        </Label>
                        <Input
                          id="plannedQuantity"
                          type="number"
                          min="0"
                          step="1"
                          value={plannedQty}
                          onChange={(e) => setPlannedQty(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="overrideReason" className="text-xs">
                          Reason for Override (Optional)
                        </Label>
                        <Input
                          id="overrideReason"
                          type="text"
                          placeholder="e.g. Special event, weather change"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full mt-4 font-bold">
                  Confirm Preparation Plan
                </Button>

                {existingDecision && (
                  <p className="text-[11px] text-center text-text-secondary">
                    Last confirmed at {formatTime(existingDecision.updatedAt)}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
