// ============================================================
// Forecasting & Preparation Recommendation Service (Integrated)
// ============================================================
// Computes baseline preparation recommendations and tracks vendor decisions.
// Data is clearly labeled as DEMONSTRATION / PROVISIONAL.
// Synchronizes with FastAPI backend at /forecasts.

import {
  ForecastRecommendation,
  ForecastMethod,
  DataQualityStatus,
  VendorDecision,
  VendorDecisionStatus,
} from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import {
  DEFAULT_BASELINE_ATTENDANCE,
  DEFAULT_SAFETY_MARGIN,
} from '../mocks/seedData';
import { apiClient } from './apiClient';

export const forecastService = {
  /**
   * Get the baseline vendor attendance (default 700).
   */
  getBaselineAttendance(): number {
    return DEFAULT_BASELINE_ATTENDANCE;
  },

  /**
   * Get the provisional safety margin fraction (default 0.08 = 8%).
   */
  getSafetyMargin(): number {
    return DEFAULT_SAFETY_MARGIN;
  },

  /**
   * Compute or retrieve the preparation recommendation for a meal instance.
   * Uses formula: F = B, Q = ceil(F * (1 + m))
   */
  getRecommendation(mealInstanceId: string): ForecastRecommendation {
    const existingRecs = storageGet<ForecastRecommendation[]>(
      StorageKey.FORECAST_RECOMMENDATIONS,
      []
    );
    const found = existingRecs.find((r) => r.mealInstanceId === mealInstanceId);
    if (found) return found;

    // Generate standard prototype recommendation
    const B = DEFAULT_BASELINE_ATTENDANCE;
    const m = DEFAULT_SAFETY_MARGIN;
    const F = B; // Initial baseline forecast
    const Q = Math.ceil(F * (1 + m)); // 756 portions

    const newRec: ForecastRecommendation = {
      mealInstanceId,
      baselineAttendance: B,
      expectedAttendance: F,
      safetyMarginFraction: m,
      recommendedPortions: Q,
      forecastMethod: ForecastMethod.BASELINE_ONLY,
      dataQualityStatus: DataQualityStatus.DEMONSTRATION,
      explanation: `DEMONSTRATION ESTIMATE: Baseline attendance of ${B} students plus a provisional ${Math.round(m * 100)}% safety margin yields ${Q} recommended portions. This formula is illustrative and not yet statistically validated.`,
    };

    storageSet(StorageKey.FORECAST_RECOMMENDATIONS, [...existingRecs, newRec]);
    return newRec;
  },

  /**
   * Fetch recommendation directly from backend.
   */
  async fetchRecommendation(mealInstanceId: string): Promise<ForecastRecommendation> {
    try {
      const rec = await apiClient.get<ForecastRecommendation>(`/forecasts/recommendation/${mealInstanceId}`);
      if (rec) {
        const existing = storageGet<ForecastRecommendation[]>(StorageKey.FORECAST_RECOMMENDATIONS, []).filter(
          (r) => r.mealInstanceId !== mealInstanceId
        );
        storageSet(StorageKey.FORECAST_RECOMMENDATIONS, [...existing, rec]);
        return rec;
      }
    } catch {
      // Fallback
    }
    return this.getRecommendation(mealInstanceId);
  },

  /**
   * Get the vendor's confirmed plan or override for a meal instance.
   */
  getVendorDecision(mealInstanceId: string): VendorDecision | null {
    const decisions = storageGet<VendorDecision[]>(
      StorageKey.VENDOR_DECISIONS,
      []
    );
    return (
      decisions.find((d) => d.mealInstanceId === mealInstanceId) ?? null
    );
  },

  /**
   * Fetch vendor decision directly from backend.
   */
  async fetchVendorDecision(mealInstanceId: string): Promise<VendorDecision | null> {
    try {
      const decision = await apiClient.get<VendorDecision>(`/forecasts/decision/${mealInstanceId}`);
      if (decision) {
        return decision;
      }
    } catch {
      // Fallback
    }
    return this.getVendorDecision(mealInstanceId);
  },

  /**
   * Save or update a vendor decision.
   * Keeps original recommendation, final planned quantity, and override reason separate.
   */
  saveVendorDecision(
    mealInstanceId: string,
    plannedQuantity: number,
    overrideReason?: string
  ): VendorDecision {
    if (plannedQuantity < 0 || !Number.isInteger(plannedQuantity)) {
      throw new Error('Quantity must be a non-negative whole number.');
    }

    const rec = this.getRecommendation(mealInstanceId);
    const isOverride = plannedQuantity !== rec.recommendedPortions;

    const decision: VendorDecision = {
      mealInstanceId,
      originalRecommendation: rec.recommendedPortions,
      finalPlannedQuantity: plannedQuantity,
      overrideReason: isOverride ? overrideReason?.trim() : undefined,
      status: isOverride
        ? VendorDecisionStatus.OVERRIDDEN
        : VendorDecisionStatus.ACCEPTED,
      updatedAt: new Date().toISOString(),
    };

    const decisions = storageGet<VendorDecision[]>(
      StorageKey.VENDOR_DECISIONS,
      []
    );
    const existingIndex = decisions.findIndex(
      (d) => d.mealInstanceId === mealInstanceId
    );

    if (existingIndex >= 0) {
      decisions[existingIndex] = decision;
    } else {
      decisions.push(decision);
    }

    storageSet(StorageKey.VENDOR_DECISIONS, decisions);

    // Sync in background to FastAPI backend
    apiClient
      .post(`/forecasts/decision/${mealInstanceId}`, {
        finalPlannedQuantity: plannedQuantity,
        overrideReason: isOverride ? overrideReason?.trim() : undefined,
      })
      .catch((err) => {
        console.warn('Backend decision sync deferred:', err.message);
      });

    return decision;
  },
};
