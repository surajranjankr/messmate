import { describe, it, expect, beforeEach } from 'vitest';
import { scheduleService } from '@/services/scheduleService';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { DayOfWeek, MealType } from '@/types';

describe('ScheduleService & Validation', () => {
  beforeEach(() => {
    resetToDefaults();
    initializeStorageIfEmpty();
  });

  it('validates 28 default notification schedules', () => {
    const schedules = scheduleService.getSchedules();
    expect(schedules.length).toBe(28);

    const validation = scheduleService.validateSchedules(schedules);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('flags error when response deadline is earlier than send time on the same day', () => {
    const schedules = scheduleService.getSchedules();
    // Invalidate Tuesday lunch: send at 12:00, deadline at 10:00 (offset 0)
    const invalidList = schedules.map((s) => {
      if (s.dayOfWeek === DayOfWeek.TUESDAY && s.mealType === MealType.LUNCH) {
        return {
          ...s,
          notifySendTime: '12:00',
          responseDeadlineTime: '10:00',
          mealDateOffset: 0,
        };
      }
      return s;
    });

    const result = scheduleService.validateSchedules(invalidList);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'responseDeadlineTime')).toBe(true);
  });

  it('detects overlapping response windows on the same weekday', () => {
    const schedules = scheduleService.getSchedules();
    // Make lunch and snacks overlap on Wednesday:
    // Lunch: 08:00 - 13:00, Snacks: 12:00 - 14:00 (overlap 12:00 - 13:00)
    const overlappingList = schedules.map((s) => {
      if (s.dayOfWeek === DayOfWeek.WEDNESDAY && s.mealType === MealType.LUNCH) {
        return { ...s, notifySendTime: '08:00', responseDeadlineTime: '13:00' };
      }
      if (s.dayOfWeek === DayOfWeek.WEDNESDAY && s.mealType === MealType.SNACKS) {
        return { ...s, notifySendTime: '12:00', responseDeadlineTime: '14:00' };
      }
      return s;
    });

    const result = scheduleService.validateSchedules(overlappingList);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]?.overlapDescription).toMatch(/overlap/i);
  });
});
