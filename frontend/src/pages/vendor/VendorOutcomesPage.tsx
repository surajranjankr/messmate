// ============================================================
// Vendor Meal Outcome Recording Page
// ============================================================
// Enables recording of post-meal operational measurements:
// attendance, actual prepared portions, and measured leftovers.

import React, { useState, useEffect } from 'react';
import { mealInstanceService } from '@/services/mealInstanceService';
import { outcomeService } from '@/services/outcomeService';
import { forecastService } from '@/services/forecastService';
import { MealInstance, MealOutcome } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDate, formatTime, formatMealType } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Scale, Utensils, Users, Info } from 'lucide-react';

export const VendorOutcomesPage: React.FC = () => {
  const [meals, setMeals] = useState<MealInstance[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [existingOutcome, setExistingOutcome] = useState<MealOutcome | null>(null);
  const [allOutcomes, setAllOutcomes] = useState<MealOutcome[]>([]);

  // Form
  const [actualAttendance, setActualAttendance] = useState<string>('');
  const [actualPrepared, setActualPrepared] = useState<string>('');
  const [leftoverQty, setLeftoverQty] = useState<string>('');
  const [leftoverUnit, setLeftoverUnit] = useState<string>('kg');
  const [notes, setNotes] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    const all = mealInstanceService.getAllMealInstances();
    setMeals(all);

    try {
      const outcomes = await outcomeService.fetchAllOutcomes();
      setAllOutcomes(outcomes);
    } catch {
      setAllOutcomes(outcomeService.getAllOutcomes());
    }

    if (all.length > 0 && !selectedMealId) {
      setSelectedMealId(all[0]!.id);
    }
  };

  useEffect(() => {
    loadData();
    const handleClockTick = () => {
      loadData();
    };
    window.addEventListener('clock-tick', handleClockTick);
    return () => window.removeEventListener('clock-tick', handleClockTick);
  }, []);

  useEffect(() => {
    if (!selectedMealId) return;

    let isSubscribed = true;
    async function fetchMealOutcome() {
      const out = await outcomeService.fetchOutcome(selectedMealId);
      if (!isSubscribed) return;

      setExistingOutcome(out);

      if (out) {
        setActualAttendance(out.actualAttendance !== undefined ? String(out.actualAttendance) : '');
        setActualPrepared(out.actualPreparedQuantity !== undefined ? String(out.actualPreparedQuantity) : '');
        setLeftoverQty(out.leftoverQuantity !== undefined ? String(out.leftoverQuantity) : '');
        setLeftoverUnit(out.leftoverUnit ?? 'kg');
        setNotes(out.notes ?? '');
      } else {
        // Must NEVER prefill actual prepared quantity with recommendations or decisions
        setActualPrepared('');
        setActualAttendance('');
        setLeftoverQty('');
        setLeftoverUnit('kg');
        setNotes('');
      }

      setSuccessMessage(null);
      setErrorMessage(null);
    }

    fetchMealOutcome();
    return () => {
      isSubscribed = false;
    };
  }, [selectedMealId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const attendanceNum = actualAttendance.trim() ? Number(actualAttendance) : undefined;
    const preparedNum = actualPrepared.trim() ? Number(actualPrepared) : undefined;
    const leftoverNum = leftoverQty.trim() ? Number(leftoverQty) : undefined;

    if (preparedNum === undefined || isNaN(preparedNum) || preparedNum < 0 || !Number.isInteger(preparedNum)) {
      setErrorMessage('Actual prepared quantity is required and must be a non-negative whole number of portions.');
      return;
    }

    if (attendanceNum !== undefined && (isNaN(attendanceNum) || attendanceNum < 0 || !Number.isInteger(attendanceNum))) {
      setErrorMessage('Actual attendance must be a valid non-negative whole number of students.');
      return;
    }

    if (leftoverNum !== undefined && (isNaN(leftoverNum) || leftoverNum < 0)) {
      setErrorMessage('Leftover quantity must be a non-negative number.');
      return;
    }

    try {
      const saved = await outcomeService.saveOutcomeAsync({
        mealInstanceId: selectedMealId,
        actualAttendance: attendanceNum,
        actualPreparedQuantity: preparedNum,
        preparedUnit: 'portions',
        leftoverQuantity: leftoverNum,
        leftoverUnit: leftoverNum !== undefined ? leftoverUnit : undefined,
        notes: notes.trim() || undefined,
      });

      setExistingOutcome(saved);
      const updated = await outcomeService.fetchAllOutcomes();
      setAllOutcomes(updated);
      setSuccessMessage('Meal outcome recorded successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save outcome.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Record Post-Meal Outcomes
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Log actual student attendance, total portions prepared, and measured leftovers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form (1 col) */}
        <Card className="lg:col-span-1 border-border shadow-xs">
          <CardHeader className="bg-lavender/30 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span>Log Meal Results</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Keep units explicit: students, portions, and kg.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {successMessage && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-success-light text-success border border-success/30 rounded-lg text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-error-light text-error border border-error/30 rounded-lg text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Meal Select */}
              <div className="space-y-1.5">
                <Label htmlFor="mealSelect" className="text-xs">Select Meal</Label>
                <Select
                  id="mealSelect"
                  value={selectedMealId}
                  onChange={(e) => setSelectedMealId(e.target.value)}
                >
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatDate(m.mealDate)} — {formatMealType(m.mealType)}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Contextual Planning Reference Badges */}
              {selectedMealId && (
                <div className="p-2.5 bg-lavender/50 border border-border-light rounded-lg space-y-1 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Planning Reference
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-text-secondary">System Recommendation:</span>
                    <span className="font-semibold text-primary">
                      {forecastService.getRecommendation(selectedMealId)?.recommendedPortions !== undefined
                        ? `${forecastService.getRecommendation(selectedMealId)?.recommendedPortions} portions`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-text-secondary">Confirmed Planned Batch:</span>
                    <span className="font-semibold text-text-primary">
                      {forecastService.getVendorDecision(selectedMealId)?.finalPlannedQuantity !== undefined
                        ? `${forecastService.getVendorDecision(selectedMealId)?.finalPlannedQuantity} portions`
                        : 'Not confirmed'}
                    </span>
                  </div>
                </div>
              )}

              {/* Actual Prepared Portions */}
              <div className="space-y-1.5">
                <Label htmlFor="actualPrepared" className="text-xs font-semibold">
                  Actual Portions Prepared (Required)
                </Label>
                <div className="relative">
                  <Input
                    id="actualPrepared"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter portions prepared"
                    value={actualPrepared}
                    onChange={(e) => setActualPrepared(e.target.value)}
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-text-secondary text-xs">
                    portions
                  </span>
                </div>
              </div>

              {/* Actual Attendance (Headcount) */}
              <div className="space-y-1.5">
                <Label htmlFor="actualAttendance" className="text-xs">
                  Actual Headcount Attendance (Optional)
                </Label>
                <div className="relative">
                  <Input
                    id="actualAttendance"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter student count (if measured)"
                    value={actualAttendance}
                    onChange={(e) => setActualAttendance(e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-text-secondary text-xs">
                    students
                  </span>
                </div>
              </div>

              {/* Leftover Quantity & Unit */}
              <div className="space-y-1.5">
                <Label htmlFor="leftoverQty" className="text-xs">
                  Measured Leftovers (Optional)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      id="leftoverQty"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="e.g. 15.5"
                      value={leftoverQty}
                      onChange={(e) => setLeftoverQty(e.target.value)}
                    />
                  </div>
                  <Select
                    value={leftoverUnit}
                    onChange={(e) => setLeftoverUnit(e.target.value)}
                  >
                    <option value="kg">kg (weight)</option>
                    <option value="portions">portions</option>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="outcomeNotes" className="text-xs">
                  Kitchen Notes & Observations (Optional)
                </Label>
                <Input
                  id="outcomeNotes"
                  type="text"
                  placeholder="e.g. Rice was finished, dal remained"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full mt-2 font-bold">
                {existingOutcome ? 'Update Outcome' : 'Save Outcome'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Outcomes Log Table (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border-light">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Historical Outcomes Log</span>
              <Badge variant="outline" className="text-xs font-mono">
                {allOutcomes.length} Recorded
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {allOutcomes.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-secondary">
                No outcomes logged yet. Use the form on the left to record meal outcomes.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meal Instance</TableHead>
                    <TableHead>Portions Prepared</TableHead>
                    <TableHead>Actual Attendance</TableHead>
                    <TableHead>Leftovers</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOutcomes.map((out) => (
                    <TableRow key={out.mealInstanceId}>
                      <TableCell className="font-semibold text-xs whitespace-nowrap">
                        {out.mealInstanceId.replace('mi-', '').toUpperCase()}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-text-primary">
                        {out.actualPreparedQuantity !== undefined
                          ? `${out.actualPreparedQuantity} portions`
                          : 'Not recorded'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {out.actualAttendance !== undefined ? (
                          <Badge variant="secondary" className="text-[11px]">
                            {out.actualAttendance} students
                          </Badge>
                        ) : (
                          <span className="text-text-secondary italic">Not measured</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {out.leftoverQuantity !== undefined ? (
                          <span className="font-semibold text-warning">
                            {out.leftoverQuantity} {out.leftoverUnit}
                          </span>
                        ) : (
                          <span className="text-text-secondary italic">Unmeasured</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary max-w-xs truncate">
                        {out.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
