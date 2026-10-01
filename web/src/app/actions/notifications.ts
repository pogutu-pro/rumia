'use server';

import { apiServer } from '@/lib/api/server';
import type { ManagerActionResult } from './manager';
import type { AppNotification } from '@/types';

/**
 * Returns the signed-in user's notifications (newest first, unread flagged).
 * Single source of truth is the FastAPI backend, not direct Supabase access.
 */
export async function getMyNotificationsAction(
  limit = 20,
): Promise<AppNotification[]> {
  const items = await apiServer<AppNotification[]>('/notifications');
  return items.slice(0, limit);
}

/**
 * Returns the signed-in user's unread notification count.
 */
export async function getUnreadNotificationsCountAction(): Promise<number> {
  const result = await apiServer<{ count: number }>('/notifications/unread-count');
  return result.count ?? 0;
}

export interface WishlistNotificationPreferences {
  wishlist_push_enabled: boolean;
  wishlist_email_enabled: boolean;
  updated_at?: string | null;
}

/**
 * Returns the current user's wishlist notification channel preferences.
 */
export async function getNotificationPreferencesAction(): Promise<WishlistNotificationPreferences> {
  return apiServer<WishlistNotificationPreferences>('/notifications/preferences');
}

/**
 * Updates the current user's wishlist notification channel preferences.
 */
export async function updateNotificationPreferencesAction(data: {
  wishlist_email_enabled?: boolean;
  wishlist_push_enabled?: boolean;
}): Promise<WishlistNotificationPreferences> {
  const payload: Partial<WishlistNotificationPreferences> = {};
  if (data.wishlist_email_enabled !== undefined) payload.wishlist_email_enabled = data.wishlist_email_enabled;
  if (data.wishlist_push_enabled !== undefined) payload.wishlist_push_enabled = data.wishlist_push_enabled;
  return apiServer<WishlistNotificationPreferences>('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Marks a single notification (or all, when no id is given) as read.
 */
export async function markNotificationReadAction(
  notificationId?: string,
): Promise<ManagerActionResult> {
  try {
    if (notificationId) {
      await apiServer(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    } else {
      await apiServer('/notifications/read-all', { method: 'PATCH' });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to mark notifications as read.' };
  }
}