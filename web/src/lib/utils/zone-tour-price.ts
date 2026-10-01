import { publicApi } from '@/lib/api/public';

/**
 * Resolves the tour amount for a zone on a specific campus via FastAPI.
 *
 * Only campus-manager-configured prices from `campus_zones.full_search_price` are used: there is
 * NO hardcoded fallback, so a student can never be quoted an amount a manager didn't set. The
 * campus must be ACTIVE. Returns null when the zone has no configured price (or the name is
 * ambiguous across campuses and no campusId was given); callers must refuse the booking and hide
 * the amount.
 *
 * @param zone - the zone (area) name, e.g. "Boma".
 * @param campusId - the campus the zone belongs to (disambiguates zone names shared by campuses).
 */
export async function getZoneTourPrice(
  zone: string | null | undefined,
  campusId?: string | null,
): Promise<number | null> {
  if (!zone) return null;
  return publicApi.getZoneTourPrice(zone, campusId);
}
