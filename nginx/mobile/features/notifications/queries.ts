import { apiFetch } from '../../lib/api/client';
import type { AppNotification } from '../../lib/api/schema';

export const notificationsKey = ['notifications'] as const;

export function fetchNotifications() {
  return apiFetch<AppNotification[]>('/notifications');
}

export function markNotificationRead(id: string) {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiFetch<{ message: string }>('/notifications/read-all', { method: 'PATCH' });
}