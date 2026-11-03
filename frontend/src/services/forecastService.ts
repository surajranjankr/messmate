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
  User,
  UserRole,
  UserStatus,
} from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import {
  DEMO_USERS,
  DEFAULT_SAFETY_MARGIN,
  DEFAULT_NONRESPONSE_ATTENDANCE_RATE,
} from '../mocks/seedData';
import { apiClient } from './apiClient';
import { responseService } from './responseService';

export const forecastService = {
  /**
   * Get the baseline student attendance dynamically from active student population.
   */
  getBaselineAttendance(): number {
    const users = storageGet<User[]>(StorageKey.USERS, DEMO_USERS);
    return users.filter(
      (u) => u.role === UserRole.STUDENT && u.status === UserStatus.ACTIVE
    ).length;
  },

  /**
   * Get the provisional safety margin fraction (default 0.08 = 8%).
   */
  getSafetyMargin(): number {
    return DEFAULT_SAFETY_MARGIN;
  },

  /**
   * Compute or retrieve the dynamic preparation recommendation for a meal instance.
   * Derived from actual response counts: F = (D * 1.0) + (P * 0.5) + (R * rate), Q = ceil(F * (1 + m))
   */
  getRecommendation(mealInstanceId: string): ForecastRecommendation {
    const existingRecs = storageGet<ForecastRecommendation[]>(
      StorageKey.FORECAST_RECOMMENDATIONS,
      []
    );
    const counts = responseService.getAggregateCounts(mealInstanceId);
    const T = counts.totalRegistered;
    const D = counts.definitelyEating;
    const P = counts.probablyEating;
    const N = counts.notEating;
    const R = counts.noResponse;

    const m = this.getSafetyMargin();
    const rate = DEFAULT_NONRESPONSE_ATTENDANCE_RATE;

    let F: number;
    let Q: number | null;
    let status: DataQualityStatus | string;
    let explanation: string;

    if (T === 0) {
      F = 0;
      Q = 0;
      status = 'ZERO_POPULATION';
      explanation = 'No active registered students found in database.';
    } else {
      F = Math.round(((D * 1.0) + (P * 0.5) + (R * rate)) * 10) / 10;
      Q = F > 0 ? Math.ceil(F * (1 + m)) : 0;
      status = DataQualityStatus.SUFFICIENT;
      explanation = `Dynamic demand model: ${T} active students (${D} definitely, ${P} probably, ${N} not eating, ${R} no response @ ${Math.round(rate * 100)}% rate). Expected demand F=${F}, safety margin ${Math.round(m * 100)}% -> ${Q} portions.`;
    }

    const rec: ForecastRecommendation = {
      mealInstanceId,
      baselineAttendance: T,
      expectedAttendance: F,
      safetyMarginFraction: m,
      recommendedPortions: Q,
      forecastMethod: ForecastMethod.BASELINE_ONLY,
      dataQualityStatus: status,
      explanation,
      definitelyEating: D,
      probablyEating: P,
      notEating: N,
      noResponse: R,
      nonresponseAttendanceRate: rate,
    };

    const filtered = existingRecs.filter((r) => r.mealInstanceId !== mealInstanceId);
    storageSet(StorageKey.FORECAST_RECOMMENDATIONS, [...filtered, rec]);
    return rec;
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
