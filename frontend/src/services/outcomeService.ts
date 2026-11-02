// ============================================================
// Meal Outcome Recording Service (Integrated)
// ============================================================
// Records and retrieves post-meal outcomes: actual attendance, prepared portions,
// and measured leftovers with explicit units. Synchronizes with FastAPI backend at /outcomes.

import { MealOutcome } from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { apiClient } from './apiClient';

export const outcomeService = {
  /**
   * Get all recorded meal outcomes.
   */
  getAllOutcomes(): MealOutcome[] {
    return storageGet<MealOutcome[]>(StorageKey.MEAL_OUTCOMES, []);
  },

  /**
   * Get the outcome for a specific meal instance, if recorded.
   */
  getOutcome(mealInstanceId: string): MealOutcome | null {
    const outcomes = this.getAllOutcomes();
    return outcomes.find((o) => o.mealInstanceId === mealInstanceId) ?? null;
  },

  /**
   * Fetch outcome from backend API.
   */
  async fetchOutcome(mealInstanceId: string): Promise<MealOutcome | null> {
    try {
      const outcome = await apiClient.get<MealOutcome>(`/outcomes/${mealInstanceId}`);
      if (outcome) {
        return outcome;
      }
    } catch {
      // Fallback
    }
    return this.getOutcome(mealInstanceId);
  },

  /**
   * Save or update an outcome record.
   * Keeps portions, headcount, and leftover weight strictly separate with explicit units.
   */
  saveOutcome(outcomeData: {
    mealInstanceId: string;
    actualAttendance?: number;
    actualPreparedQuantity?: number;
    preparedUnit: string;
    leftoverQuantity?: number;
    leftoverUnit?: string;
    notes?: string;
  }): MealOutcome {
    if (
      outcomeData.actualAttendance !== undefined &&
      (outcomeData.actualAttendance < 0 || !Number.isInteger(outcomeData.actualAttendance))
    ) {
      throw new Error('Actual attendance must be a non-negative whole number of students.');
    }

    if (
      outcomeData.actualPreparedQuantity !== undefined &&
      (outcomeData.actualPreparedQuantity < 0 || !Number.isInteger(outcomeData.actualPreparedQuantity))
    ) {
      throw new Error('Actual prepared quantity must be a non-negative whole number.');
    }

    if (
      outcomeData.leftoverQuantity !== undefined &&
      outcomeData.leftoverQuantity < 0
    ) {
      throw new Error('Leftover quantity cannot be negative.');
    }

    const outcome: MealOutcome = {
      ...outcomeData,
      recordedAt: new Date().toISOString(),
    };

    const outcomes = this.getAllOutcomes();
    const existingIndex = outcomes.findIndex(
      (o) => o.mealInstanceId === outcomeData.mealInstanceId
    );

    if (existingIndex >= 0) {
      outcomes[existingIndex] = outcome;
    } else {
      outcomes.push(outcome);
    }

    storageSet(StorageKey.MEAL_OUTCOMES, outcomes);

    // Sync in background with backend
    apiClient
      .post(`/outcomes/${outcomeData.mealInstanceId}`, outcomeData)
      .catch((err) => {
        console.warn('Backend outcome sync deferred:', err.message);
      });

    return outcome;
  },
};
