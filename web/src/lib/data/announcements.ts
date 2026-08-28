import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase/public';
import type { PublicAnnouncement } from '@/types';

/**
 * Active announcements for a campus, fetched server-side for public pages.
 *
 * Deliberately does NOT wrap this in unstable_cache/fetch revalidation: Next 16
 * collapses the route's revalidate window to the minimum of any nested
 * unstable_cache/fetch revalidate, which would force /hostels and the landing
 * page to regenerate far more often than their 3600s ISR window — directly
 * against Rumia's Vercel resource constraints. Page-level ISR already bounds
 * regeneration to the existing windows, `cache()` dedupes repeated calls within
 * one render, and manager mutations call revalidatePath() so changes appear
 * immediately. Expired rows are filtered by the database (expires_at > now()),
 * never downloaded and filtered in JavaScript, and only the columns the public
 * UI needs are selected.
 */
export const getActiveAnnouncements = cache(
  async (
    campusId: string | null | undefined,
  ): Promise<PublicAnnouncement[]> => {
    if (!campusId) return [];

    const { data } = await supabasePublic
      .from('announcements')
      .select('id, title, message, type')
      .eq('campus_id', campusId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    return (data || []) as PublicAnnouncement[];
  },
);
