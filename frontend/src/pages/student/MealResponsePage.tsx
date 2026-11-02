// ============================================================
// Meal Response Page (Individual Meal Submission)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { mealInstanceService } from '@/services/mealInstanceService';
import { menuService } from '@/services/menuService';
import { responseService } from '@/services/responseService';
import {
  MealInstance,
  MealResponse,
  ResponseChoice,
  MenuMealEntry,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  formatDate,
  formatTime,
  formatMealType,
  formatResponseChoice,
  getDayOfWeekFromDate,
  isBeforeDeadline,
} from '@/lib/utils';
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Check,
  Info,
  Calendar,
} from 'lucide-react';
import { parseISO } from 'date-fns';

export const MealResponsePage: React.FC = () => {
  const { mealId } = useParams<{ mealId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meal, setMeal] = useState<MealInstance | null>(null);
  const [menuEntry, setMenuEntry] = useState<MenuMealEntry | null>(null);
  const [existingResponse, setExistingResponse] = useState<MealResponse | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<ResponseChoice | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMealData = () => {
    if (!mealId || !user) return;

    const inst = mealInstanceService.getMealInstance(mealId);
    if (!inst) {
      setErrorMessage('Meal not found.');
      return;
    }
    setMeal(inst);

    // Menu details
    const mealDate = parseISO(inst.mealDate);
    const dayOfWeek = getDayOfWeekFromDate(mealDate);
    const entry = menuService.getMenuForMeal(dayOfWeek, inst.mealType, inst.menuVersionId);
    setMenuEntry(entry);

    // Existing response
    const resp = responseService.getMyResponse(user.id, inst.id);
    setExistingResponse(resp);
    if (resp) {
      setSelectedChoice(resp.choice);
    }
  };

  useEffect(() => {
    loadMealData();
    const handleClockTick = () => loadMealData();
    window.addEventListener('clock-tick', handleClockTick);
    return () => window.removeEventListener('clock-tick', handleClockTick);
  }, [mealId, user]);

  if (!meal) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-error mx-auto" />
        <h3 className="text-lg font-bold">Meal Not Found</h3>
        <p className="text-sm text-text-secondary">The requested meal instance could not be found.</p>
        <Link to="/student/meals">
          <Button variant="outline">Back to Meal Schedule</Button>
        </Link>
      </div>
    );
  }

  const isDeadlinePassed = !isBeforeDeadline(meal.responseDeadline);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChoice) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const saved = responseService.submitResponse(user.id, meal.id, selectedChoice);
      setExistingResponse(saved);
      setSuccessMessage(
        existingResponse
          ? 'Your response was updated successfully!'
          : 'Your meal intention was recorded successfully!'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit response.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/student/meals"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Meal Schedule</span>
        </Link>
      </div>

      {/* Main Response Card */}
      <Card className="border-border shadow-md overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-primary/15 via-lavender to-background p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="font-semibold text-xs">
                  {formatMealType(meal.mealType)}
                </Badge>
                {isDeadlinePassed ? (
                  <Badge variant="error" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Response Closed</span>
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1 animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>Open for Responses</span>
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold text-text-primary">
                {formatMealType(meal.mealType)} &bull; {formatDate(meal.mealDate)}
              </h2>
            </div>

            <div className="text-xs text-text-secondary sm:text-right">
              <div>Response Deadline:</div>
              <div className="font-semibold text-text-primary text-sm">
                {formatTime(meal.responseDeadline)}
              </div>
              <div className="text-[11px] text-text-secondary">
                {formatDate(meal.responseDeadline)}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Status Alert */}
          {successMessage && (
            <div className="flex items-center gap-2 p-4 bg-success-light text-success border border-success/30 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 p-4 bg-error-light text-error border border-error/30 rounded-xl text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isDeadlinePassed && (
            <div className="p-4 bg-lavender/60 border border-border rounded-xl flex items-start gap-3 text-xs text-text-secondary">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-text-primary block text-sm mb-0.5">
                  The deadline for this meal has passed
                </span>
                {existingResponse ? (
                  <span>
                    Your recorded choice is locked as <strong>{formatResponseChoice(existingResponse.choice)}</strong>. You can no longer change this response.
                  </span>
                ) : (
                  <span>
                    No response was recorded for this meal prior to the deadline.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Menu Details Card */}
          <div className="bg-background rounded-xl p-4 border border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
              <Utensils className="w-4 h-4 text-primary" />
              <span>Published Menu for this Meal</span>
            </h4>

            {menuEntry ? (
              <div className="space-y-3 text-xs">
                {/* Main Dishes */}
                <div>
                  <span className="font-semibold text-text-primary block mb-1">Dishes:</span>
                  <div className="flex flex-wrap gap-2">
                    {menuEntry.dishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="bg-card border border-border px-3 py-1.5 rounded-lg text-text-primary shadow-2xs"
                      >
                        <span className="font-medium">{dish.name}</span>
                        {dish.alternatives && dish.alternatives.length > 0 && (
                          <span className="text-[11px] text-text-secondary ml-1 italic">
                            (alt: {dish.alternatives.join(', ')})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accompaniments */}
                {menuEntry.accompaniments.length > 0 && (
                  <div>
                    <span className="font-semibold text-text-secondary block mb-1">Accompaniments & Beverages:</span>
                    <p className="text-text-primary">{menuEntry.accompaniments.join(' • ')}</p>
                  </div>
                )}

                {/* Source Notes & Serving Limits */}
                {menuEntry.notes.length > 0 && (
                  <div className="pt-2 border-t border-border-light text-[11px] text-text-secondary">
                    <span className="font-semibold text-primary">Rules & Serving Limits: </span>
                    {menuEntry.notes.join('; ')}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">Menu details not loaded.</p>
            )}
          </div>

          {/* Response Selection Area */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-base font-bold text-text-primary block mb-1">
                Will you be attending this meal?
              </Label>
              <p className="text-xs text-text-secondary mb-3">
                Select your intention. Your response will help the kitchen prepare enough food and eliminate wastage.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Choice 1: Definitely Eating */}
                <button
                  type="button"
                  disabled={isDeadlinePassed}
                  onClick={() => setSelectedChoice(ResponseChoice.DEFINITELY_EATING)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                    selectedChoice === ResponseChoice.DEFINITELY_EATING
                      ? 'border-success bg-success-light/40 shadow-sm'
                      : 'border-border bg-card hover:bg-lavender/40'
                  } ${isDeadlinePassed ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-success-light text-success flex items-center justify-center mb-2 font-bold text-sm">
                    {selectedChoice === ResponseChoice.DEFINITELY_EATING ? <Check className="w-5 h-5" /> : '1'}
                  </div>
                  <span className="font-bold text-sm text-text-primary">Definitely Eating</span>
                  <span className="text-[11px] text-text-secondary mt-1">
                    Count me in for sure
                  </span>
                </button>

                {/* Choice 2: Probably Eating */}
                <button
                  type="button"
                  disabled={isDeadlinePassed}
                  onClick={() => setSelectedChoice(ResponseChoice.PROBABLY_EATING)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                    selectedChoice === ResponseChoice.PROBABLY_EATING
                      ? 'border-warning bg-warning-light/40 shadow-sm'
                      : 'border-border bg-card hover:bg-lavender/40'
                  } ${isDeadlinePassed ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-warning-light text-warning flex items-center justify-center mb-2 font-bold text-sm">
                    {selectedChoice === ResponseChoice.PROBABLY_EATING ? <Check className="w-5 h-5" /> : '2'}
                  </div>
                  <span className="font-bold text-sm text-text-primary">Probably Eating</span>
                  <span className="text-[11px] text-text-secondary mt-1">
                    Likely to attend
                  </span>
                </button>

                {/* Choice 3: Not Eating */}
                <button
                  type="button"
                  disabled={isDeadlinePassed}
                  onClick={() => setSelectedChoice(ResponseChoice.NOT_EATING)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                    selectedChoice === ResponseChoice.NOT_EATING
                      ? 'border-error bg-error-light/40 shadow-sm'
                      : 'border-border bg-card hover:bg-lavender/40'
                  } ${isDeadlinePassed ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-error-light text-error flex items-center justify-center mb-2 font-bold text-sm">
                    {selectedChoice === ResponseChoice.NOT_EATING ? <Check className="w-5 h-5" /> : '3'}
                  </div>
                  <span className="font-bold text-sm text-text-primary">Not Eating</span>
                  <span className="text-[11px] text-text-secondary mt-1">
                    Will not attend
                  </span>
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border-light">
              <div className="text-xs text-text-secondary">
                {existingResponse && (
                  <span>
                    Previously submitted:{' '}
                    <strong>{formatResponseChoice(existingResponse.choice)}</strong> at{' '}
                    {formatTime(existingResponse.updatedAt)}
                  </span>
                )}
              </div>

              {!isDeadlinePassed && (
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !selectedChoice}
                  className="w-full sm:w-auto"
                >
                  {submitting
                    ? 'Saving...'
                    : existingResponse
                    ? 'Update My Intention'
                    : 'Submit Intention'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
