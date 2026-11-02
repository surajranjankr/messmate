import { describe, it, expect, beforeEach } from 'vitest';
import { menuService } from '@/services/menuService';
import { resetToDefaults, initializeStorageIfEmpty } from '@/lib/storage';
import { MenuVersionStatus, DayOfWeek, MealType } from '@/types';

describe('MenuService & Versioning', () => {
  beforeEach(() => {
    resetToDefaults();
    initializeStorageIfEmpty();
  });

  it('provides a published menu version on initial load', () => {
    const published = menuService.getPublishedMenu();
    expect(published).not.toBeNull();
    expect(published?.status).toBe(MenuVersionStatus.PUBLISHED);
    expect(published?.meals.length).toBe(28); // 7 days x 4 meals
  });

  it('keeps draft edits isolated from the published menu', () => {
    const publishedBefore = menuService.getPublishedMenu();
    const draft = menuService.getOrCreateDraft();

    // Modify the draft by changing Monday breakfast
    const modifiedMeals = draft.meals.map((m) => {
      if (m.dayOfWeek === DayOfWeek.MONDAY && m.mealType === MealType.BREAKFAST) {
        return {
          ...m,
          dishes: [{ id: 'test-dish', name: 'Special Masala Dosa' }],
        };
      }
      return m;
    });

    menuService.saveDraft(modifiedMeals, 'Test update draft');

    // Published menu must still contain the original dish
    const publishedAfter = menuService.getPublishedMenu();
    const mondayBf = publishedAfter?.meals.find(
      (m) => m.dayOfWeek === DayOfWeek.MONDAY && m.mealType === MealType.BREAKFAST
    );
    expect(mondayBf?.dishes.some((d) => d.name === 'Special Masala Dosa')).toBe(false);
  });

  it('creates an immutable new version upon publishing and archives previous version', () => {
    const initialPublished = menuService.getPublishedMenu();
    const initialVersionNumber = initialPublished?.versionNumber ?? 1;

    // Create draft and publish
    menuService.getOrCreateDraft();
    const newPublished = menuService.publishDraft('Published Version 2 Release');

    expect(newPublished.versionNumber).toBe(initialVersionNumber + 1);
    expect(newPublished.status).toBe(MenuVersionStatus.PUBLISHED);

    // History contains both versions
    const history = menuService.getVersionHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);

    const oldArchived = history.find((v) => v.id === initialPublished?.id);
    expect(oldArchived?.status).toBe(MenuVersionStatus.ARCHIVED);
  });
});
