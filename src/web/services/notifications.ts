import { fetchJson, guardPrivateSession, isOffline } from './http';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: 'expiry' | 'shopping' | 'planner' | 'household' | 'system';
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export const notificationsApi = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ notifications: AppNotification[] }>('/notifications');
      assertCurrent();
      return Array.isArray(res.notifications) ? res.notifications : [];
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      return [];
    }
  },

  markNotificationRead: async (id: string): Promise<AppNotification> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<{ success: boolean; notification: AppNotification }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH', body: JSON.stringify({}) }
    );
    assertCurrent();
    return res.notification;
  },

  markAllNotificationsRead: async (): Promise<{ success: boolean; updatedCount: number }> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<{ success: boolean; updatedCount: number }>(
      '/notifications/read-all',
      { method: 'POST', body: JSON.stringify({}) }
    );
    assertCurrent();
    return res;
  },
};
