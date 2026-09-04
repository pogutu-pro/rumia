'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ManagerActionResult } from './manager';
import type { AppNotification } from '@/types';

/**
 * Creates an in-app notification row for a user. Server-side (service role) so
 * it bypasses the insert RLS policy (which is intentionally service_role only).
 */
export async function createAppNotification(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}) {
  const { error } = await supabaseAdmin.from('app_notifications').insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    url: params.url ?? null,
  });
  if (error) {
    console.error('Failed to insert in-app notification:', error.message);
  }
}

/**
 * Returns the signed-in user's notifications (newest first, unread flagged).
 */
export async function getMyNotificationsAction(
  limit = 20,
): Promise<AppNotification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as AppNotification[]) || [];
}

/**
 * Returns the signed-in user's unread notification count.
 */
export async function getUnreadNotificationsCountAction(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  return count ?? 0;
}

/**
 * Marks a single notification (or all, when no id is given) as read.
 */
export async function markNotificationReadAction(
  notificationId?: string,
): Promise<ManagerActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'You must be signed in.' };

  let query = supabase.from('app_notifications').update({ is_read: true });
  if (notificationId) {
    query = query.eq('id', notificationId);
  }
  query = query.eq('user_id', user.id);

  const { error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}