// ============================================================
// Meal Instance Service
// ============================================================
// Manages concrete meal instances for specific calendar dates,
// along with deadlines and dynamic status transitions.

import { MealInstance, MealInstanceStatus, MealType } from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { getCurrentTime } from '../lib/clock';
import { parseISO, format, isBefore, isAfter } from 'date-fns';
import { menuService } from './menuService';

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
   * Get the next meal requiring response (RESPONSE_OPEN or earliest UPCOMING).
   */
  getNextActionableMeal(): MealInstance | null {
    const instances = this.getAllMealInstances();
    const openMeals = instances
      .filter((inst) => inst.status === MealInstanceStatus.RESPONSE_OPEN)
      .sort((a, b) => parseISO(a.responseDeadline).getTime() - parseISO(b.responseDeadline).getTime());

    if (openMeals.length > 0) {
      return openMeals[0]!;
    }

    const upcomingMeals = instances
      .filter((inst) => inst.status === MealInstanceStatus.UPCOMING)
      .sort((a, b) => parseISO(a.mealDate).getTime() - parseISO(b.mealDate).getTime());

    return upcomingMeals[0] ?? null;
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
