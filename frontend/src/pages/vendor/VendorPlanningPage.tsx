// ============================================================
// Vendor Meal Planning Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  formatDate,
  formatTime,
  formatMealType,
  getDayOfWeekFromDate,
  isBeforeDeadline,
} from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  ArrowLeft,
  Utensils,
  TrendingUp,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { parseISO } from 'date-fns';

export const VendorPlanningPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mealIdParam = searchParams.get('mealId');

  const [meals, setMeals] = useState<MealInstance[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<MealInstance | null>(null);
  const [counts, setCounts] = useState<MealCounts | null>(null);
  const [recommendation, setRecommendation] = useState<ForecastRecommendation | null>(null);
  const [existingDecision, setExistingDecision] = useState<VendorDecision | null>(null);

  // Form state
  const [plannedQty, setPlannedQty] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isOverrideMode, setIsOverrideMode] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadMeals = () => {
    const all = mealInstanceService.getAllMealInstances();
    setMeals(all);

    const initialId = mealIdParam && all.some((m) => m.id === mealIdParam)
      ? mealIdParam
      : all[0]?.id ?? '';

    setSelectedMealId(initialId);
  };

  useEffect(() => {
    loadMeals();
    const handleClockTick = () => loadMeals();
    window.addEventListener('clock-tick', handleClockTick);
    return () => window.removeEventListener('clock-tick', handleClockTick);
  }, []);

  useEffect(() => {
    if (!selectedMealId) return;

    const meal = meals.find((m) => m.id === selectedMealId) ?? null;
    setSelectedMeal(meal);

    if (meal) {
      const c = responseService.getAggregateCounts(meal.id);
      setCounts(c);

      const rec = forecastService.getRecommendation(meal.id);
      setRecommendation(rec);

      const decision = forecastService.getVendorDecision(meal.id);
      setExistingDecision(decision);

      if (decision) {
        setPlannedQty(String(decision.finalPlannedQuantity));
        setOverrideReason(decision.overrideReason ?? '');
        setIsOverrideMode(decision.status === VendorDecisionStatus.OVERRIDDEN);
      } else {
        setPlannedQty(String(rec.recommendedPortions));
        setOverrideReason('');
        setIsOverrideMode(false);
      }

      setSuccessMessage(null);
      setFormError(null);
    }
  }, [selectedMealId, meals]);

  const handleMealChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedMealId(newId);
    setSearchParams({ mealId: newId });
  };

  const handleAcceptRecommendation = () => {
    if (!recommendation) return;
    setPlannedQty(String(recommendation.recommendedPortions));
    setIsOverrideMode(false);
    setOverrideReason('');
    setFormError(null);
  };

  const handleConfirmPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal || !recommendation) return;

    const parsedQty = Number(plannedQty);
    if (isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty < 0) {
      setFormError('Planned quantity must be a valid non-negative whole number.');
      return;
    }

    try {
      const saved = forecastService.saveVendorDecision(
        selectedMeal.id,
        parsedQty,
        isOverrideMode ? overrideReason : undefined
      );
      setExistingDecision(saved);
      setSuccessMessage(
        `Batch preparation plan confirmed: ${saved.finalPlannedQuantity} portions.`
      );
      setFormError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save plan.';
      setFormError(msg);
    }
  };

  const getMenuSummary = (inst?: MealInstance | null) => {
    if (!inst) return '';
    const mealDate = parseISO(inst.mealDate);
    const day = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(day, inst.mealType, inst.menuVersionId);
    if (!entry) return 'Menu available';
    return entry.dishes.map((d) => d.name).join(', ');
  };

  const isPastDeadline = selectedMeal ? !isBeforeDeadline(selectedMeal.responseDeadline) : false;

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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            Kitchen Preparation Planning
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Review student intentions, examine forecast recommendations, and confirm batch quantities.
          </p>
        </div>

        {/* Meal Selector */}
        <div className="w-full sm:w-72">
          <Select value={selectedMealId} onChange={handleMealChange}>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {formatDate(m.mealDate)} — {formatMealType(m.mealType)}
              </option>
            ))}
          </Select>
        </div>
      </div>

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

      {selectedMeal && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Meal Details & Response Counts (2 cols) */}
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
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Response Window Active
                      </Badge>
                    )}
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
                  Menu: {getMenuSummary(selectedMeal)}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* 4 Counts */}
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

                      {/* No Response */}
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
                    <span>Total Registered Cohort: <strong>{counts?.totalRegistered ?? 750} students</strong></span>
                    <span className="italic">No Response is strictly separated from Not Eating.</span>
                  </div>
                </div>

                {/* Recommendation Explanation */}
                {recommendation && (
                  <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Recommendation Logic & Methodology</span>
                      </span>
                      <Badge variant="muted" className="text-[10px]">
                        Demo Model
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                      <div className="p-2 bg-lavender/30 rounded-lg">
                        <span className="text-text-secondary block">Baseline (B):</span>
                        <span className="font-bold text-text-primary text-sm">{recommendation.baselineAttendance}</span>
                      </div>
                      <div className="p-2 bg-lavender/30 rounded-lg">
                        <span className="text-text-secondary block">Safety Margin (m):</span>
                        <span className="font-bold text-text-primary text-sm">{recommendation.safetyMarginFraction * 100}%</span>
                      </div>
                      <div className="p-2 bg-lavender/30 rounded-lg">
                        <span className="text-text-secondary block">Recommended (Q):</span>
                        <span className="font-bold text-primary text-sm">{recommendation.recommendedPortions} Portions</span>
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed pt-1">
                      {recommendation.explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Vendor Decision Form (1 col) */}
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
                            placeholder="e.g. Festival weekend, rain forecast"
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
      )}
    </div>
  );
};
