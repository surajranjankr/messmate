// ============================================================
// localStorage Persistence Layer for MessMate
// ============================================================
// Provides versioned, type-safe access to localStorage with
// JSON parsing safety and seed-data initialization.

import {
  demoUsers,
  demoMealInstances,
  demoMealResponses,
  demoNotifications,
  demoNotificationSchedules,
  demoVendorDecisions,
  demoMealOutcomes,
  demoForecastRecommendations,
  demoMenuVersions,
} from '../mocks/seedData';

const STORAGE_PREFIX = 'MESSMATE_STORAGE_V1';

// --- Storage Keys ---

export enum StorageKey {
  USERS = 'users',
  CURRENT_USER = 'currentUser',
  MEAL_INSTANCES = 'mealInstances',
  MEAL_RESPONSES = 'mealResponses',
  NOTIFICATIONS = 'notifications',
  NOTIFICATION_SCHEDULES = 'notificationSchedules',
  VENDOR_DECISIONS = 'vendorDecisions',
  MEAL_OUTCOMES = 'mealOutcomes',
  FORECAST_RECOMMENDATIONS = 'forecastRecommendations',
  MENU_VERSIONS = 'menuVersions',
  CLOCK_MOCK_TIME = 'clockMockTime',
  INSTITUTION_SETTINGS = 'institutionSettings',
}

// --- Helpers ---

function prefixedKey(key: StorageKey): string {
  return `${STORAGE_PREFIX}_${key}`;
}

/**
 * Safely parse JSON from a string, returning the fallback on any error.
 */
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    // Basic schema validation: parsed must be the same broad type as fallback
    if (fallback !== null && typeof fallback === 'object') {
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      if (!Array.isArray(fallback) && (Array.isArray(parsed) || typeof parsed !== 'object')) {
        return fallback;
      }
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

// --- Public API ---

/**
 * Get a value from storage by key, with type safety and a fallback.
 */
export function storageGet<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefixedKey(key));
    return safeJsonParse<T>(raw, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Set a value in storage by key.
 */
export function storageSet<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(prefixedKey(key), JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to set storage for key ${key}:`, err);
  }
}

/**
 * Remove a value from storage by key.
 */
export function storageRemove(key: StorageKey): void {
  try {
    localStorage.removeItem(prefixedKey(key));
  } catch (err) {
    console.warn(`Failed to remove storage key ${key}:`, err);
  }
}

/**
 * Check if a key exists in storage.
 */
export function storageHas(key: StorageKey): boolean {
  try {
    return localStorage.getItem(prefixedKey(key)) !== null;
  } catch {
    return false;
  }
}

/**
 * Clear ALL MessMate data from localStorage (keys with our prefix).
 */
export function resetToDefaults(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn('Failed to reset storage:', err);
  }
}

/**
 * Initialize storage with seed data if it has not been initialized yet.
 * Checks for the presence of the USERS key as a sentinel.
 */
export function initializeStorageIfEmpty(): void {
  // Purge legacy mock outcome / decision artifacts if present in existing localStorage
  try {
    const existingOutcomes = storageGet<any[]>(StorageKey.MEAL_OUTCOMES, []);
    if (existingOutcomes.some((o) => o?.actualPreparedQuantity === 756 || o?.notes === 'Demo outcome data')) {
      storageSet(
        StorageKey.MEAL_OUTCOMES,
        existingOutcomes.filter((o) => o?.actualPreparedQuantity !== 756 && o?.notes !== 'Demo outcome data')
      );
    }
    const existingDecisions = storageGet<any[]>(StorageKey.VENDOR_DECISIONS, []);
    if (existingDecisions.some((d) => d?.finalPlannedQuantity === 780 || d?.finalPlannedQuantity === 756)) {
      storageSet(
        StorageKey.VENDOR_DECISIONS,
        existingDecisions.filter((d) => d?.finalPlannedQuantity !== 780 && d?.finalPlannedQuantity !== 756)
      );
    }
  } catch {
    // ignore
  }

  if (storageHas(StorageKey.USERS)) {
    // Already initialized — skip.
    return;
  }

  storageSet(StorageKey.USERS, demoUsers);
  storageSet(StorageKey.MEAL_INSTANCES, demoMealInstances);
  storageSet(StorageKey.MEAL_RESPONSES, demoMealResponses);
  storageSet(StorageKey.NOTIFICATIONS, demoNotifications);
  storageSet(StorageKey.NOTIFICATION_SCHEDULES, demoNotificationSchedules);
  storageSet(StorageKey.VENDOR_DECISIONS, demoVendorDecisions);
  storageSet(StorageKey.MEAL_OUTCOMES, demoMealOutcomes);
  storageSet(StorageKey.FORECAST_RECOMMENDATIONS, demoForecastRecommendations);
  storageSet(StorageKey.MENU_VERSIONS, demoMenuVersions);
}
