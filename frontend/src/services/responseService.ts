// ============================================================
// Student Response Service (Integrated Full-Stack)
// ============================================================
// Manages meal-intention responses, enforces deadline locking,
// preserves individual privacy, and aggregates counts for vendor views.
// Synchronizes with FastAPI backend at /responses.

import {
  MealResponse,
  ResponseChoice,
  MealCounts,
  User,
  UserRole,
  UserStatus,
} from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { isBeforeDeadline, isAfterOpeningTime, generateId } from '../lib/utils';
import { mealInstanceService } from './mealInstanceService';
import { DEMO_USERS } from '../mocks/seedData';
import { apiClient } from './apiClient';

export const responseService = {
  /**
   * Get all responses currently stored. Internal use only.
   */
  _getAllResponses(): MealResponse[] {
    return storageGet<MealResponse[]>(StorageKey.MEAL_RESPONSES, []);
  },

  /**
   * Retrieve the current student's response for a specific meal instance.
   * Never exposes another student's response.
   */
  getMyResponse(studentId: string, mealInstanceId: string): MealResponse | null {
    const responses = this._getAllResponses();
    return (
      responses.find(
        (r) => r.studentId === studentId && r.mealInstanceId === mealInstanceId
      ) ?? null
    );
  },

  /**
   * Fetch my response directly from backend API.
   */
  async fetchMyResponse(mealInstanceId: string): Promise<MealResponse | null> {
    try {
      const resp = await apiClient.get<MealResponse>(`/responses/my?mealInstanceId=${mealInstanceId}`);
      return resp || null;
    } catch {
      return null;
    }
  },

  /**
   * Submit or update a meal intention response.
   * Enforces deadline locking and syncs with FastAPI backend.
   */
  submitResponse(
    studentId: string,
    mealInstanceId: string,
    choice: ResponseChoice
  ): MealResponse {
    const meal = mealInstanceService.getMealInstance(mealInstanceId);
    if (!meal) {
      throw new Error('Meal instance not found.');
    }

    // Strict window enforcement: opening_time <= now < closing_time
    if (meal.status === 'UPCOMING' || !isAfterOpeningTime(meal.responseOpenTime)) {
      throw new Error(
        'The response window for this meal has not opened yet. Responses can only be submitted during the open window.'
      );
    }
    if (!isBeforeDeadline(meal.responseDeadline) || meal.status === 'RESPONSE_CLOSED' || meal.status === 'COMPLETED') {
      throw new Error(
        'The deadline for this meal has passed. Responses can no longer be submitted or changed.'
      );
    }

    const responses = this._getAllResponses();
    const existingIndex = responses.findIndex(
      (r) => r.studentId === studentId && r.mealInstanceId === mealInstanceId
    );

    const now = new Date().toISOString();
    let result: MealResponse;

    if (existingIndex >= 0) {
      // Update existing response
      result = {
        ...responses[existingIndex]!,
        choice,
        updatedAt: now,
      };
      responses[existingIndex] = result;
    } else {
      // Create new response
      result = {
        id: `resp-${generateId().slice(0, 8)}`,
        studentId,
        mealInstanceId,
        choice,
        createdAt: now,
        updatedAt: now,
      };
      responses.push(result);
    }

    storageSet(StorageKey.MEAL_RESPONSES, responses);

    // Sync in background to FastAPI backend
    apiClient
      .post<MealResponse>('/responses', {
        mealInstanceId,
        choice,
      })
      .catch((err) => {
        console.warn('Backend response synchronization deferred:', err.message);
      });

    return result;
  },

  /**
   * Async version of submitResponse that awaits backend confirmation.
   */
  async submitResponseAsync(
    studentId: string,
    mealInstanceId: string,
    choice: ResponseChoice
  ): Promise<MealResponse> {
    const meal = mealInstanceService.getMealInstance(mealInstanceId);
    if (meal && (meal.status === 'UPCOMING' || !isAfterOpeningTime(meal.responseOpenTime))) {
      throw new Error(
        'The response window for this meal has not opened yet. Responses can only be submitted during the open window.'
      );
    }
    if (meal && (!isBeforeDeadline(meal.responseDeadline) || meal.status === 'RESPONSE_CLOSED' || meal.status === 'COMPLETED')) {
      throw new Error(
        'The deadline for this meal has passed. Responses can no longer be submitted or changed.'
      );
    }

    try {
      const serverResp = await apiClient.post<MealResponse>('/responses', {
        mealInstanceId,
        choice,
      });
      if (serverResp) {
        const responses = this._getAllResponses().filter(
          (r) => !(r.studentId === studentId && r.mealInstanceId === mealInstanceId)
        );
        responses.push(serverResp);
        storageSet(StorageKey.MEAL_RESPONSES, responses);
        return serverResp;
      }
    } catch (err) {
      // If server rejected with 400 (e.g. deadline), rethrow
      throw err;
    }

    return this.submitResponse(studentId, mealInstanceId, choice);
  },

  /**
   * Get the private response history for a specific student.
   * Excludes any responses belonging to other students.
   */
  getMyHistory(studentId: string): MealResponse[] {
    const responses = this._getAllResponses();
    return responses
      .filter((r) => r.studentId === studentId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  /**
   * Calculate aggregate response counts for a meal instance.
   *
   * CRITICAL BUSINESS RULE:
   * "No Response must remain a separate category. Never count it as Not Eating."
   */
  getAggregateCounts(mealInstanceId: string): MealCounts {
    const users = storageGet<User[]>(StorageKey.USERS, DEMO_USERS);
    const eligibleStudents = users.filter(
      (u) => u.role === UserRole.STUDENT && u.status === UserStatus.ACTIVE
    );
    const eligibleIds = new Set(eligibleStudents.map((u) => u.id));
    const totalRegistered = eligibleStudents.length;

    const responses = this._getAllResponses().filter(
      (r) => r.mealInstanceId === mealInstanceId && eligibleIds.has(r.studentId)
    );

    // Deduplicate per student to guarantee unique counts
    const uniqueResponses = new Map<string, ResponseChoice>();
    for (const r of responses) {
      uniqueResponses.set(r.studentId, r.choice);
    }

    let definitelyEating = 0;
    let probablyEating = 0;
    let notEating = 0;

    for (const choice of uniqueResponses.values()) {
      if (choice === ResponseChoice.DEFINITELY_EATING) definitelyEating++;
      else if (choice === ResponseChoice.PROBABLY_EATING) probablyEating++;
      else if (choice === ResponseChoice.NOT_EATING) notEating++;
    }

    const totalResponded = definitelyEating + probablyEating + notEating;
    const noResponse = Math.max(0, totalRegistered - totalResponded);

    return {
      definitelyEating,
      probablyEating,
      notEating,
      noResponse,
      totalRegistered,
    };
  },

  /**
   * Asynchronously fetch aggregate counts from backend.
   */
  async fetchAggregateCounts(mealInstanceId: string): Promise<MealCounts> {
    try {
      const counts = await apiClient.get<MealCounts>(`/responses/counts/${mealInstanceId}`);
      if (counts) return counts;
    } catch {
      // Fall back to local calculation
    }
    return this.getAggregateCounts(mealInstanceId);
  },
};
