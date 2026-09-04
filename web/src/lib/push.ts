import webPush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT = "mailto:hello@rumiamanage.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Automatically cleans up stale subscriptions (410 Gone / 404).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured — skipping push");
    return { sent: 0, failed: 0 };
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const body = JSON.stringify(payload);

  for (const sub of subscriptions) {
    const subscription: webPush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    try {
      await webPush.sendNotification(subscription, body);

      // Update last_used_at
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sub.id);

      sent++;
    } catch (err: any) {
      // 410 Gone or 404 = subscription expired or invalid — delete it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
      }
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Get all active admin user IDs.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  return profiles?.map((p: any) => p.id as string) ?? [];
}

/**
 * Get manager user IDs for a specific campus.
 * Includes campus managers AND region managers whose region contains the campus.
 * If zero managers exist for that campus, falls back to admin user IDs (Step 4 bootstrap fallback).
 */
export async function getManagerUserIdsForCampus(campusId: string): Promise<string[]> {
  // Campus managers assigned directly to this campus.
  const { data: campusManagers } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'manager')
    .eq('managed_campus_id', campusId);

  // Region managers whose region covers this campus.
  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('region_id')
    .eq('id', campusId)
    .maybeSingle();

  let regionManagerIds: string[] = [];
  if (campus?.region_id) {
    const { data: regionManagers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'manager')
      .eq('managed_region_id', campus.region_id);
    regionManagerIds = regionManagers?.map((m: any) => m.id as string) ?? [];
  }

  const managerIds = new Set<string>([
    ...(campusManagers?.map((m: any) => m.id as string) ?? []),
    ...regionManagerIds,
  ]);

  if (managerIds.size > 0) {
    return Array.from(managerIds);
  }

  // Fallback to admin if campus has zero managers
  return getAdminUserIds();
}

/**
 * Send a push notification to multiple users at once.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}
