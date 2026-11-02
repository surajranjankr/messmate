// ============================================================
// Notification Schedule Service
// ============================================================
// Manages the 28 weekday/meal schedules, validates time boundaries,
// and detects overlapping response windows with required administrator acknowledgement.

import {
  NotificationSchedule,
  ScheduleValidationResult,
  ScheduleValidationError,
  ScheduleOverlapWarning,
  MealType,
  DayOfWeek,
} from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { formatDayOfWeek, formatMealType } from '../lib/utils';
import { apiClient } from './apiClient';

export const scheduleService = {
  /**
   * Get all 28 notification schedules.
   */
  getSchedules(): NotificationSchedule[] {
    return storageGet<NotificationSchedule[]>(
      StorageKey.NOTIFICATION_SCHEDULES,
      []
    );
  },

  /**
   * Update a specific schedule.
   */
  updateSchedule(
    id: string,
    updates: Partial<NotificationSchedule>
  ): NotificationSchedule {
    const schedules = this.getSchedules();
    const index = schedules.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Schedule with id ${id} not found.`);
    }

    const updatedSchedule: NotificationSchedule = {
      ...schedules[index]!,
      ...updates,
      id,
    };

    schedules[index] = updatedSchedule;
    storageSet(StorageKey.NOTIFICATION_SCHEDULES, schedules);

    // Sync with backend
    apiClient.patch(`/schedules/${id}`, updates).catch(() => {});

    return updatedSchedule;
  },

  /**
   * Helper: convert HH:mm string to minutes from start of day.
   */
  timeToMinutes(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    return hours * 60 + minutes;
  },

  /**
   * Validate all schedules or a modified list.
   * Checks for missing values, invalid ordering, and overlapping windows.
   */
  validateSchedules(
    schedulesToValidate?: NotificationSchedule[]
  ): ScheduleValidationResult {
    const schedules = schedulesToValidate ?? this.getSchedules();
    const errors: ScheduleValidationError[] = [];
    const warnings: ScheduleOverlapWarning[] = [];

    // 1. Basic validation per schedule
    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      if (!schedule.notifySendTime || schedule.notifySendTime.trim() === '') {
        errors.push({
          scheduleId: schedule.id,
          field: 'notifySendTime',
          message: `Send time is required for ${formatDayOfWeek(schedule.dayOfWeek)} ${formatMealType(schedule.mealType)}.`,
        });
      }

      if (
        !schedule.responseDeadlineTime ||
        schedule.responseDeadlineTime.trim() === ''
      ) {
        errors.push({
          scheduleId: schedule.id,
          field: 'responseDeadlineTime',
          message: `Response deadline is required for ${formatDayOfWeek(schedule.dayOfWeek)} ${formatMealType(schedule.mealType)}.`,
        });
      }

      if (schedule.notifySendTime && schedule.responseDeadlineTime) {
        const sendMins = this.timeToMinutes(schedule.notifySendTime);
        const deadlineMins = this.timeToMinutes(schedule.responseDeadlineTime);

        // If offset is same day, deadline must be strictly after send time
        if (schedule.mealDateOffset === 0 && deadlineMins <= sendMins) {
          errors.push({
            scheduleId: schedule.id,
            field: 'responseDeadlineTime',
            message: `Response deadline (${schedule.responseDeadlineTime}) must be after notification send time (${schedule.notifySendTime}) on the same day.`,
          });
        }
      }
    }

    // 2. Overlap detection between active schedules on the same send day
    // (e.g. lunch window overlapping with snacks window)
    for (let i = 0; i < schedules.length; i++) {
      const s1 = schedules[i]!;
      if (!s1.enabled) continue;

      for (let j = i + 1; j < schedules.length; j++) {
        const s2 = schedules[j]!;
        if (!s2.enabled) continue;

        // Compare if on the same day of week
        if (s1.dayOfWeek === s2.dayOfWeek) {
          const s1Start = this.timeToMinutes(s1.notifySendTime);
          const s1End = this.timeToMinutes(s1.responseDeadlineTime);
          const s2Start = this.timeToMinutes(s2.notifySendTime);
          const s2End = this.timeToMinutes(s2.responseDeadlineTime);

          // Check if [s1Start, s1End] overlaps with [s2Start, s2End]
          const isOverlapping = Math.max(s1Start, s2Start) < Math.min(s1End, s2End);

          if (isOverlapping) {
            const label1 = `${formatDayOfWeek(s1.dayOfWeek)} ${formatMealType(s1.mealType)} (${s1.notifySendTime} - ${s1.responseDeadlineTime})`;
            const label2 = `${formatDayOfWeek(s2.dayOfWeek)} ${formatMealType(s2.mealType)} (${s2.notifySendTime} - ${s2.responseDeadlineTime})`;

            const isAck = s1.overlapAcknowledged && s2.overlapAcknowledged;

            warnings.push({
              schedule1Id: s1.id,
              schedule2Id: s2.id,
              schedule1Label: label1,
              schedule2Label: label2,
              overlapDescription: `Response windows overlap between ${label1} and ${label2}. Students will have multiple concurrent response windows open.`,
              acknowledged: !!isAck,
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Explicitly acknowledge an overlap between two schedules.
   */
  acknowledgeOverlap(schedule1Id: string, schedule2Id: string): void {
    const schedules = this.getSchedules();
    const updated = schedules.map((s) => {
      if (s.id === schedule1Id || s.id === schedule2Id) {
        return { ...s, overlapAcknowledged: true };
      }
      return s;
    });
    storageSet(StorageKey.NOTIFICATION_SCHEDULES, updated);

    // Sync with backend
    apiClient.post('/schedules/acknowledge-overlap', { schedule1Id, schedule2Id }).catch(() => {});
  },

  /**
   * Fetch all 28 schedules from backend.
   */
  async fetchSchedules(): Promise<NotificationSchedule[]> {
    try {
      const data = await apiClient.get<NotificationSchedule[]>('/schedules');
      if (data && Array.isArray(data)) {
        storageSet(StorageKey.NOTIFICATION_SCHEDULES, data);
        return data;
      }
    } catch {
      // Fallback
    }
    return this.getSchedules();
  },
};
