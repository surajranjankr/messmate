// ============================================================
// Meal Instance Service
// ============================================================
// Manages concrete meal instances for specific calendar dates,
// along with deadlines and dynamic status transitions.

import { MealInstance, MealInstanceStatus, MealType } from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { getCurrentTime } from '../lib/clock';
import { isAfterOpeningTime } from '../lib/utils';
import { parseISO, format, isBefore, isAfter } from 'date-fns';
import { menuService } from './menuService';
import { apiClient } from './apiClient';

export const mealInstanceService = {
  /**
   * Get all meal instances, dynamically refreshing their statuses.
   */
  getAllMealInstances(): MealInstance[] {
    const instances = storageGet<MealInstance[]>(StorageKey.MEAL_INSTANCES, []);
    return this.refreshStatuses(instances);
  },

  /**
   * Refresh the status of instances based on current clock time.
   */
  refreshStatuses(instances: MealInstance[]): MealInstance[] {
    const now = getCurrentTime();
    let hasChanges = false;

    const updated = instances.map((instance) => {
      // Completed meals stay completed
      if (instance.status === MealInstanceStatus.COMPLETED) {
        return instance;
      }

      const deadline = parseISO(instance.responseDeadline);
      const isPastDeadline = isAfter(now, deadline);

      // Simple heuristic for completed: if meal date was yesterday or earlier
      const mealDate = parseISO(instance.mealDate);
      const isPastMealDay = isAfter(
        now,
        new Date(mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate() + 1, 0, 0, 0)
      );

      let newStatus: MealInstanceStatus = instance.status;
      if (isPastMealDay) {
        newStatus = MealInstanceStatus.COMPLETED;
      } else if (isPastDeadline) {
        newStatus = MealInstanceStatus.RESPONSE_CLOSED;
      } else if (instance.responseOpenTime && !isAfterOpeningTime(instance.responseOpenTime)) {
        newStatus = MealInstanceStatus.UPCOMING;
      } else {
        newStatus = MealInstanceStatus.RESPONSE_OPEN;
      }

      if (newStatus !== instance.status) {
        hasChanges = true;
        return { ...instance, status: newStatus };
      }
      return instance;
    });

    if (hasChanges) {
      storageSet(StorageKey.MEAL_INSTANCES, updated);
    }
    return updated;
  },

  /**
   * Get an instance by ID.
   */
  getMealInstance(id: string): MealInstance | null {
    const instances = this.getAllMealInstances();
    return instances.find((inst) => inst.id === id) ?? null;
  },

  /**
   * Get meals scheduled for a specific date (YYYY-MM-DD).
   */
  getMealsByDate(dateStr: string): MealInstance[] {
    const instances = this.getAllMealInstances();
    return instances.filter((inst) => inst.mealDate === dateStr);
  },

  /**
   * Get today's meal instances.
   */
  getTodaysMeals(): MealInstance[] {
    const now = getCurrentTime();
    const todayStr = format(now, 'yyyy-MM-dd');
    return this.getMealsByDate(todayStr);
  },

  /**
   * Get the next meal requiring response or incoming preparation (RESPONSE_OPEN or earliest UPCOMING).
   */
  getNextActionableMeal(): MealInstance | null {
    const instances = this.getAllMealInstances();
    const now = getCurrentTime();
    const todayStr = format(now, 'yyyy-MM-dd');

    const MEAL_ORDER: Record<string, number> = {
      BREAKFAST: 1,
      LUNCH: 2,
      SNACKS: 3,
      DINNER: 4,
    };

    // 1. Today's meals that are uncompleted (both RESPONSE_OPEN and RESPONSE_CLOSED)
    const todaysUncompleted = instances
      .filter((inst) => inst.mealDate === todayStr && inst.status !== MealInstanceStatus.COMPLETED)
      .sort((a, b) => (MEAL_ORDER[a.mealType] ?? 99) - (MEAL_ORDER[b.mealType] ?? 99));

    if (todaysUncompleted.length > 0) {
      // If any meal today is still open for responses, prepare that first
      const openMeal = todaysUncompleted.find((inst) => inst.status === MealInstanceStatus.RESPONSE_OPEN);
      if (openMeal) return openMeal;

      // If response deadline has closed (e.g. Dinner past 5:00 PM), final counts are ready
      // and this meal is actively being prepared in the kitchen!
      const closedMeals = todaysUncompleted.filter((inst) => inst.status === MealInstanceStatus.RESPONSE_CLOSED);
      if (closedMeals.length > 0) {
        return closedMeals[closedMeals.length - 1]!;
      }

      return todaysUncompleted[0]!;
    }

    // 2. Future open meals
    const otherOpen = instances
      .filter((inst) => inst.status === MealInstanceStatus.RESPONSE_OPEN)
      .sort((a, b) => parseISO(a.responseDeadline).getTime() - parseISO(b.responseDeadline).getTime());

    if (otherOpen.length > 0) {
      return otherOpen[0]!;
    }

    // 3. Upcoming meals on future days
    const upcomingMeals = instances
      .filter((inst) => inst.status === MealInstanceStatus.UPCOMING)
      .sort((a, b) => {
        const dateDiff = parseISO(a.mealDate).getTime() - parseISO(b.mealDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (MEAL_ORDER[a.mealType] ?? 99) - (MEAL_ORDER[b.mealType] ?? 99);
      });

    if (upcomingMeals.length > 0) {
      return upcomingMeals[0]!;
    }

    // Fallback: earliest upcoming or non-completed scheduled meal
    const remaining = instances
      .filter((inst) => inst.status !== MealInstanceStatus.COMPLETED)
      .sort((a, b) => parseISO(a.responseDeadline).getTime() - parseISO(b.responseDeadline).getTime());

    return remaining[0] ?? instances[0] ?? null;
  },

  /**
   * Asynchronously fetch authoritative actionable meal from backend API,
   * falling back to local calculation if offline.
   */
  async fetchActionableMealInstance(): Promise<MealInstance | null> {
    try {
      const res = await apiClient.get<MealInstance>('/meals/actionable');
      return res;
    } catch {
      return this.getNextActionableMeal();
    }
  },

  /**
   * Add or replace a meal instance.
   */
  saveMealInstance(instance: MealInstance): void {
    const instances = storageGet<MealInstance[]>(StorageKey.MEAL_INSTANCES, []);
    const index = instances.findIndex((i) => i.id === instance.id);
    if (index >= 0) {
      instances[index] = instance;
    } else {
      instances.push(instance);
    }
    storageSet(StorageKey.MEAL_INSTANCES, instances);
  },
};
