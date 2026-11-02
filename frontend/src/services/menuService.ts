// ============================================================
// Menu Service
// ============================================================
// Manages menu drafts, published versions, immutable version history,
// and meal lookups.

import {
  MenuVersion,
  MenuVersionStatus,
  MenuMealEntry,
  DayOfWeek,
  MealType,
} from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { generateId } from '../lib/utils';
import { initialMenuData } from '../mocks/menuData';

export const menuService = {
  /**
   * Get all menu versions stored (draft, published, archived).
   */
  getAllVersions(): MenuVersion[] {
    return storageGet<MenuVersion[]>(StorageKey.MENU_VERSIONS, []);
  },

  /**
   * Get the currently active published menu version.
   */
  getPublishedMenu(): MenuVersion | null {
    const versions = this.getAllVersions();
    return (
      versions.find((v) => v.status === MenuVersionStatus.PUBLISHED) ?? null
    );
  },

  /**
   * Get the current draft menu version, if one exists.
   */
  getDraft(): MenuVersion | null {
    const versions = this.getAllVersions();
    return (
      versions.find((v) => v.status === MenuVersionStatus.DRAFT) ?? null
    );
  },

  /**
   * Get or initialize a draft for editing. If no draft exists,
   * copies from the current published menu or defaults.
   */
  getOrCreateDraft(): MenuVersion {
    const draft = this.getDraft();
    if (draft) return draft;

    const published = this.getPublishedMenu();
    const baseMeals = published
      ? JSON.parse(JSON.stringify(published.meals))
      : JSON.parse(JSON.stringify(initialMenuData));

    const newDraft: MenuVersion = {
      id: `menu-draft-${generateId().slice(0, 8)}`,
      versionNumber: (published?.versionNumber ?? 1) + 1,
      status: MenuVersionStatus.DRAFT,
      meals: baseMeals,
      createdAt: new Date().toISOString(),
      changeSummary: 'Work in progress',
    };

    const versions = this.getAllVersions();
    storageSet(StorageKey.MENU_VERSIONS, [...versions, newDraft]);
    return newDraft;
  },

  /**
   * Save changes to the draft menu.
   */
  saveDraft(meals: MenuMealEntry[], changeSummary?: string): MenuVersion {
    const versions = this.getAllVersions();
    let draftIndex = versions.findIndex((v) => v.status === MenuVersionStatus.DRAFT);

    if (draftIndex === -1) {
      const draft = this.getOrCreateDraft();
      draftIndex = versions.length; // appended
      versions.push(draft);
    }

    const updatedDraft: MenuVersion = {
      ...versions[draftIndex]!,
      meals,
      changeSummary: changeSummary ?? versions[draftIndex]!.changeSummary,
    };

    versions[draftIndex] = updatedDraft;
    storageSet(StorageKey.MENU_VERSIONS, versions);
    return updatedDraft;
  },

  /**
   * Discard current draft.
   */
  discardDraft(): void {
    const versions = this.getAllVersions().filter(
      (v) => v.status !== MenuVersionStatus.DRAFT
    );
    storageSet(StorageKey.MENU_VERSIONS, versions);
  },

  /**
   * Publish the draft menu as a new immutable version.
   * Marks previous published versions as ARCHIVED.
   */
  publishDraft(changeSummary: string = 'Published update'): MenuVersion {
    const versions = this.getAllVersions();
    const draft = versions.find((v) => v.status === MenuVersionStatus.DRAFT);

    if (!draft) {
      throw new Error('No draft exists to publish.');
    }

    const currentPublished = versions.find(
      (v) => v.status === MenuVersionStatus.PUBLISHED
    );

    // Archive previous published
    const updatedVersions = versions.map((v) => {
      if (v.status === MenuVersionStatus.PUBLISHED) {
        return { ...v, status: MenuVersionStatus.ARCHIVED };
      }
      return v;
    });

    const newPublishedVersion: MenuVersion = {
      ...draft,
      id: `menu-v${(currentPublished?.versionNumber ?? 0) + 1}-${generateId().slice(0, 6)}`,
      versionNumber: (currentPublished?.versionNumber ?? 0) + 1,
      status: MenuVersionStatus.PUBLISHED,
      publishedAt: new Date().toISOString(),
      changeSummary,
    };

    // Replace the draft with the newly published version
    const finalVersions = updatedVersions
      .filter((v) => v.status !== MenuVersionStatus.DRAFT)
      .concat(newPublishedVersion);

    storageSet(StorageKey.MENU_VERSIONS, finalVersions);
    return newPublishedVersion;
  },

  /**
   * Retrieve version history (all versions sorted latest first).
   */
  getVersionHistory(): MenuVersion[] {
    const versions = this.getAllVersions();
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  },

  /**
   * Get specific menu entry for day and meal from a version (or published).
   */
  getMenuForMeal(
    dayOfWeek: DayOfWeek,
    mealType: MealType,
    versionId?: string
  ): MenuMealEntry | null {
    let version: MenuVersion | null = null;
    if (versionId) {
      version = this.getAllVersions().find((v) => v.id === versionId) ?? null;
    } else {
      version = this.getPublishedMenu();
    }

    if (!version) return null;
    return (
      version.meals.find(
        (m) => m.dayOfWeek === dayOfWeek && m.mealType === mealType
      ) ?? null
    );
  },
};
