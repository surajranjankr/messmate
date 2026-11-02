// ============================================================
// Utility Functions for MessMate
// ============================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { MealType, DayOfWeek, ResponseChoice } from '../types';
import { getCurrentTime } from './clock';

// --- Class Name Utility ---

/** Merge Tailwind classes with clsx for conditional class names */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// --- Date / Time Formatting ---

/** Format an ISO date string to a human-readable date (e.g. "Nov 3, 2026") */
export function formatDate(isoString: string): string {
  return format(parseISO(isoString), 'MMM d, yyyy');
}

/** Format an ISO date string to time only (e.g. "9:00 PM") */
export function formatTime(isoString: string): string {
  return format(parseISO(isoString), 'h:mm a');
}

/** Format an ISO date string to full date+time (e.g. "Nov 3, 2026 at 9:00 PM") */
export function formatDateTime(isoString: string): string {
  return format(parseISO(isoString), "MMM d, yyyy 'at' h:mm a");
}

// --- Enum Formatting ---

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  [MealType.BREAKFAST]: 'Breakfast',
  [MealType.LUNCH]: 'Lunch',
  [MealType.SNACKS]: 'Snacks',
  [MealType.DINNER]: 'Dinner',
};

/** Format a MealType enum value to a display string (e.g. BREAKFAST -> "Breakfast") */
export function formatMealType(mealType: MealType): string {
  return MEAL_TYPE_LABELS[mealType] ?? mealType;
}

const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Monday',
  [DayOfWeek.TUESDAY]: 'Tuesday',
  [DayOfWeek.WEDNESDAY]: 'Wednesday',
  [DayOfWeek.THURSDAY]: 'Thursday',
  [DayOfWeek.FRIDAY]: 'Friday',
  [DayOfWeek.SATURDAY]: 'Saturday',
  [DayOfWeek.SUNDAY]: 'Sunday',
};

/** Format a DayOfWeek enum value to a display string (e.g. MONDAY -> "Monday") */
export function formatDayOfWeek(day: DayOfWeek): string {
  return DAY_OF_WEEK_LABELS[day] ?? day;
}

const RESPONSE_CHOICE_LABELS: Record<ResponseChoice, string> = {
  [ResponseChoice.DEFINITELY_EATING]: 'Definitely Eating',
  [ResponseChoice.PROBABLY_EATING]: 'Probably Eating',
  [ResponseChoice.NOT_EATING]: 'Not Eating',
};

/** Format a ResponseChoice enum value to a display string */
export function formatResponseChoice(choice: ResponseChoice): string {
  return RESPONSE_CHOICE_LABELS[choice] ?? choice;
}

// --- Deadline Logic ---

/**
 * Check if the current time (via the injectable clock) is before
 * the given ISO 8601 deadline string.
 */
export function isBeforeDeadline(deadline: string): boolean {
  const deadlineDate = parseISO(deadline);
  const now = getCurrentTime();
  return now.getTime() < deadlineDate.getTime();
}

// --- ID Generation ---

/** Generate a unique ID using crypto.randomUUID with a fallback */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- Meal Type Ordering ---

const MEAL_TYPE_ORDER: Record<MealType, number> = {
  [MealType.BREAKFAST]: 0,
  [MealType.LUNCH]: 1,
  [MealType.SNACKS]: 2,
  [MealType.DINNER]: 3,
};

/** Get the sort order for a meal type (breakfast=0, lunch=1, snacks=2, dinner=3) */
export function getMealTypeOrder(mealType: MealType): number {
  return MEAL_TYPE_ORDER[mealType] ?? 0;
}

// --- Day of Week from Date ---

const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  DayOfWeek.SUNDAY,    // 0
  DayOfWeek.MONDAY,    // 1
  DayOfWeek.TUESDAY,   // 2
  DayOfWeek.WEDNESDAY, // 3
  DayOfWeek.THURSDAY,  // 4
  DayOfWeek.FRIDAY,    // 5
  DayOfWeek.SATURDAY,  // 6
];

/** Get the DayOfWeek enum value from a JavaScript Date object */
export function getDayOfWeekFromDate(date: Date): DayOfWeek {
  return JS_DAY_TO_DAY_OF_WEEK[date.getDay()]!;
}
