// ============================================================
// Institution Settings Service (Integrated Full-Stack)
// ============================================================
// Manages retrieval and persistent updates of institutional parameters:
// display name, timezone, and provisional safety margin.
// Synchronizes with FastAPI backend at /settings.

import { apiClient } from './apiClient';
import { storageGet, storageSet, StorageKey } from '../lib/storage';

export interface InstitutionSettings {
  id: string;
  institutionName: string;
  timezone: string;
  safetyMarginFraction: number; // e.g. 0.08, 0.20
  safetyMarginPercentage: number; // e.g. 8.0, 20.0
  updatedAt: string;
}

const DEFAULT_SETTINGS: InstitutionSettings = {
  id: 'default',
  institutionName: 'Indian Institute of Information Technology Dharwad',
  timezone: 'Asia/Kolkata',
  safetyMarginFraction: 0.08,
  safetyMarginPercentage: 8.0,
  updatedAt: new Date().toISOString(),
};

export const settingsService = {
  /**
   * Get cached settings synchronously from localStorage.
   */
  getSettings(): InstitutionSettings {
    return storageGet<InstitutionSettings>(StorageKey.INSTITUTION_SETTINGS as any, DEFAULT_SETTINGS);
  },

  /**
   * Asynchronously fetch persistent institution settings from backend API.
   */
  async fetchSettings(): Promise<InstitutionSettings> {
    try {
      const data = await apiClient.get<InstitutionSettings>('/settings');
      if (data) {
        storageSet(StorageKey.INSTITUTION_SETTINGS as any, data);
        return data;
      }
    } catch (err: unknown) {
      console.warn('Backend settings fetch deferred:', err);
    }
    return this.getSettings();
  },

  /**
   * Asynchronously update institution settings on backend API.
   */
  async saveSettings(updateData: {
    institutionName?: string;
    timezone?: string;
    safetyMarginPercentage?: number;
    safetyMarginFraction?: number;
  }): Promise<InstitutionSettings> {
    const res = await apiClient.put<InstitutionSettings>('/settings', updateData);
    if (res) {
      storageSet(StorageKey.INSTITUTION_SETTINGS as any, res);
      return res;
    }
    throw new Error('Failed to save settings.');
  },
};
