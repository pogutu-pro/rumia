import { getCampusBySlug } from '@/lib/data/campuses';
import type { Campus } from '@/types';

// Generalized route shape: /hostels/{county}/{area}/… where county is the
// campus city (lowercased) and area is the campus slug. Returns null for any
// combination that does not match a live campus so callers can notFound().
export async function resolveCampusFromSegments(
  county: string,
  area: string,
): Promise<Campus | null> {
  const campus = await getCampusBySlug(area);
  if (campus.slug !== area) return null;
  if (campus.city.toLowerCase() !== county.toLowerCase()) return null;
  return campus;
}
