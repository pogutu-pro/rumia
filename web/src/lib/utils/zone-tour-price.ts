import { supabasePublic } from '@/lib/supabase/public';

/**
 * Resolves the tour amount for a zone on a specific campus.
 *
 * Only campus-manager-configured prices from `campus_zones.full_search_price`
 * are used — there is NO hardcoded fallback, so a student can never be quoted
 * an amount a manager didn't set. The campus must be ACTIVE. Returns null when
 * the zone has no configured price; callers must refuse the booking and hide
 * the amount.
 *
 * @param zone - the zone (area) name, e.g. "Boma".
 * @param campusId - the UUID of the campus the zone belongs to. When provided
 *   the price is looked up scoped to that campus (one query). When omitted the
 *   zone is resolved across active campuses and must be unambiguous.
 */
export async function getZoneTourPrice(
  zone: string | null | undefined,
  campusId?: string | null,
): Promise<number | null> {
  if (!zone) return null;
  try {
    if (campusId) {
      const { data } = await supabasePublic
        .from('campus_zones')
        .select('full_search_price, campuses!inner(status)')
        .eq('campus_id', campusId)
        .eq('name', zone)
        .eq('campuses.status', 'active')
        .maybeSingle();
      if (data?.full_search_price != null) {
        return data.full_search_price;
      }
      return null;
    }

    // No campus known — the zone must resolve to exactly one active campus.
    const { data } = await supabasePublic
      .from('campus_zones')
      .select('full_search_price, campuses!inner(status)')
      .eq('name', zone)
      .eq('campuses.status', 'active')
      .maybeSingle();
    if (data?.full_search_price != null) {
      return data.full_search_price;
    }
  } catch {
    // Fall through to null (includes ambiguous zone names across campuses).
  }
  return null;
}