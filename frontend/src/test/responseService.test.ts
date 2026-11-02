import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { responseService } from '@/services/responseService';
import { mealInstanceService } from '@/services/mealInstanceService';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { setMockTime, resetClock } from '@/lib/clock';
import { ResponseChoice, MealType, MealInstanceStatus } from '@/types';

describe('ResponseService', () => {
  const testStudentId = 'user-student-arjun';
  const otherStudentId = 'user-student-priya';
  const testMealId = 'mi-test-lunch';

  beforeEach(() => {
    resetToDefaults();
    initializeStorageIfEmpty();

    // Create a predictable meal instance for testing
    mealInstanceService.saveMealInstance({
      id: testMealId,
      mealDate: '2026-11-05',
      mealType: MealType.LUNCH,
      menuVersionId: 'menu-v1',
      responseDeadline: '2026-11-05T09:30:00+05:30',
      status: MealInstanceStatus.RESPONSE_OPEN,
    });
  });

  afterEach(() => {
    resetClock();
  });

  it('submits a new meal response before deadline', () => {
    // Set clock to 1 hour before deadline
    setMockTime(new Date('2026-11-05T08:30:00+05:30'));

    const res = responseService.submitResponse(
      testStudentId,
      testMealId,
      ResponseChoice.DEFINITELY_EATING
    );

    expect(res.studentId).toBe(testStudentId);
    expect(res.choice).toBe(ResponseChoice.DEFINITELY_EATING);

    const saved = responseService.getMyResponse(testStudentId, testMealId);
    expect(saved?.choice).toBe(ResponseChoice.DEFINITELY_EATING);
  });

  it('updates an existing response before deadline without creating duplicates', () => {
    setMockTime(new Date('2026-11-05T08:00:00+05:30'));
    responseService.submitResponse(
      testStudentId,
      testMealId,
      ResponseChoice.DEFINITELY_EATING
    );

    setMockTime(new Date('2026-11-05T08:30:00+05:30'));
    const updated = responseService.submitResponse(
      testStudentId,
      testMealId,
      ResponseChoice.PROBABLY_EATING
    );

    expect(updated.choice).toBe(ResponseChoice.PROBABLY_EATING);

    // Verify only ONE response exists for this student on this meal
    const history = responseService.getMyHistory(testStudentId);
    const mealResponses = history.filter((r) => r.mealInstanceId === testMealId);
    expect(mealResponses.length).toBe(1);
    expect(mealResponses[0]?.choice).toBe(ResponseChoice.PROBABLY_EATING);
  });

  it('rejects responses submitted after the deadline', () => {
    // Set clock to 5 minutes AFTER deadline
    setMockTime(new Date('2026-11-05T09:35:00+05:30'));

    expect(() => {
      responseService.submitResponse(
        testStudentId,
        testMealId,
        ResponseChoice.NOT_EATING
      );
    }).toThrow(/deadline/i);
  });

  it('preserves privacy: student history contains ONLY their own records', () => {
    setMockTime(new Date('2026-11-05T08:00:00+05:30'));
    responseService.submitResponse(
      testStudentId,
      testMealId,
      ResponseChoice.DEFINITELY_EATING
    );
    responseService.submitResponse(
      otherStudentId,
      testMealId,
      ResponseChoice.NOT_EATING
    );

    const arjunHistory = responseService.getMyHistory(testStudentId);
    expect(arjunHistory.every((r) => r.studentId === testStudentId)).toBe(true);
    expect(arjunHistory.some((r) => r.studentId === otherStudentId)).toBe(false);
  });

  it('strictly separates No Response from Not Eating in aggregate counts', () => {
    setMockTime(new Date('2026-11-05T08:00:00+05:30'));
    responseService.submitResponse(testStudentId, testMealId, ResponseChoice.DEFINITELY_EATING);
    responseService.submitResponse(otherStudentId, testMealId, ResponseChoice.NOT_EATING);

    const counts = responseService.getAggregateCounts(testMealId);

    expect(counts.definitelyEating).toBe(1);
    expect(counts.notEating).toBe(1);
    expect(counts.probablyEating).toBe(0);

    // No Response should be 750 - 2 = 748, strictly separate from Not Eating
    expect(counts.noResponse).toBe(counts.totalRegistered - 2);
    expect(counts.noResponse).not.toBe(counts.notEating);
  });
});
