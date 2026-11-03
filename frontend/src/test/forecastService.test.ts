import { describe, it, expect, beforeEach } from 'vitest';
import { forecastService } from '@/services/forecastService';
import { outcomeService } from '@/services/outcomeService';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { VendorDecisionStatus } from '@/types';

describe('Forecast & Outcome Services', () => {
  const mealId = 'mi-test-vendor-meal';

  beforeEach(() => {
    resetToDefaults();
    initializeStorageIfEmpty();
  });

  it('computes recommended portions based on baseline B, responses, and margin m: Q = ceil(F * (1 + m))', () => {
    const rec = forecastService.getRecommendation(mealId);
    expect(rec.baselineAttendance).toBe(3);
    expect(rec.expectedAttendance).toBe(2.1);
    expect(rec.safetyMarginFraction).toBe(0.08);
    // F = 3 * 0.70 = 2.1; ceil(2.1 * 1.08) = 3
    expect(rec.recommendedPortions).toBe(3);
  });

  it('accepts vendor overrides without modifying the original recommendation', () => {
    const originalRec = forecastService.getRecommendation(mealId);

    // Vendor overrides quantity to 800 with an explicit reason
    const decision = forecastService.saveVendorDecision(
      mealId,
      800,
      'Expecting high attendance due to sports tournament'
    );

    expect(decision.finalPlannedQuantity).toBe(800);
    expect(decision.originalRecommendation).toBe(3);
    expect(decision.status).toBe(VendorDecisionStatus.OVERRIDDEN);
    expect(decision.overrideReason).toBe('Expecting high attendance due to sports tournament');

    // Original recommendation must remain unchanged
    const currentRec = forecastService.getRecommendation(mealId);
    expect(currentRec.recommendedPortions).toBe(3);
  });

  it('validates planned quantity is a non-negative whole number', () => {
    expect(() => {
      forecastService.saveVendorDecision(mealId, -10);
    }).toThrow(/non-negative/i);

    expect(() => {
      forecastService.saveVendorDecision(mealId, 750.5);
    }).toThrow(/whole number/i);
  });

  it('records post-meal outcomes with explicit units', () => {
    const outcome = outcomeService.saveOutcome({
      mealInstanceId: mealId,
      actualPreparedQuantity: 760,
      preparedUnit: 'portions',
      actualAttendance: 725,
      leftoverQuantity: 18.5,
      leftoverUnit: 'kg',
      notes: 'Rice finished, sabzi remained',
    });

    expect(outcome.actualPreparedQuantity).toBe(760);
    expect(outcome.actualAttendance).toBe(725);
    expect(outcome.leftoverQuantity).toBe(18.5);
    expect(outcome.leftoverUnit).toBe('kg');

    const fetched = outcomeService.getOutcome(mealId);
    expect(fetched?.leftoverQuantity).toBe(18.5);
  });
});
