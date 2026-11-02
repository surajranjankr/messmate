// ============================================================
// In-App Notification Service (Mock / Simulated)
// ============================================================
// Simulates notification centre functionality. No real external push or
// WhatsApp messages are sent in this frontend phase.

import { Notification } from '../types';
import { storageGet, storageSet, StorageKey } from '../lib/storage';
import { generateId } from '../lib/utils';
import { apiClient } from './apiClient';

export const notificationService = {
  /**
   * Retrieve all in-app notifications.
   */
  getNotifications(): Notification[] {
    const notifs = storageGet<Notification[]>(StorageKey.NOTIFICATIONS, []);
    return [...notifs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  /**
   * Get total count of unread notifications.
   */
  getUnreadCount(): number {
    return this.getNotifications().filter((n) => !n.isRead).length;
  },

  /**
   * Mark a specific notification as read.
   */
  markAsRead(notificationId: string): void {
    const notifs = storageGet<Notification[]>(StorageKey.NOTIFICATIONS, []);
    const updated = notifs.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    storageSet(StorageKey.NOTIFICATIONS, updated);
    apiClient.patch(`/notifications/${notificationId}/read`).catch(() => {});
  },

  /**
   * Mark all notifications as read.
   */
  markAllAsRead(): void {
    const notifs = storageGet<Notification[]>(StorageKey.NOTIFICATIONS, []);
    const updated = notifs.map((n) => ({ ...n, isRead: true }));
    storageSet(StorageKey.NOTIFICATIONS, updated);
    apiClient.post('/notifications/mark-all-read').catch(() => {});
  },

  /**
   * Fetch notifications from backend API.
   */
  async fetchNotifications(): Promise<Notification[]> {
    try {
      const data = await apiClient.get<Notification[]>('/notifications');
      if (data && Array.isArray(data)) {
        storageSet(StorageKey.NOTIFICATIONS, data);
        return data;
      }
    } catch {
      // Fallback
    }
    return this.getNotifications();
  },

  /**
   * Add a new simulated notification.
   */
  addNotification(
    title: string,
    message: string,
    mealInstanceId?: string
  ): Notification {
    const notifs = storageGet<Notification[]>(StorageKey.NOTIFICATIONS, []);
    const newNotif: Notification = {
      id: `notif-${generateId().slice(0, 8)}`,
      title,
      message,
      createdAt: new Date().toISOString(),
      isRead: false,
      mealInstanceId,
    };
    storageSet(StorageKey.NOTIFICATIONS, [newNotif, ...notifs]);
    return newNotif;
  },
};
