import { describe, it, expect, beforeEach } from 'vitest';
import {
  storageGet,
  storageSet,
  storageRemove,
  storageHas,
  resetToDefaults,
  StorageKey,
} from '@/lib/storage';

describe('Storage Layer', () => {
  beforeEach(() => {
    resetToDefaults();
  });

  it('safely stores and retrieves objects', () => {
    const testObj = { name: 'Mess Test', active: true };
    storageSet(StorageKey.CURRENT_USER, testObj);
    expect(storageHas(StorageKey.CURRENT_USER)).toBe(true);

    const retrieved = storageGet(StorageKey.CURRENT_USER, null);
    expect(retrieved).toEqual(testObj);
  });

  it('returns fallback value gracefully when key does not exist', () => {
    const fallback = { fallback: true };
    const val = storageGet(StorageKey.USERS, fallback);
    expect(val).toEqual(fallback);
  });

  it('removes keys cleanly', () => {
    storageSet(StorageKey.CURRENT_USER, { id: 'test' });
    expect(storageHas(StorageKey.CURRENT_USER)).toBe(true);

    storageRemove(StorageKey.CURRENT_USER);
    expect(storageHas(StorageKey.CURRENT_USER)).toBe(false);
  });
});
