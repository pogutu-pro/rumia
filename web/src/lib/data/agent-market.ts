import { campusesServerApi } from '@/lib/api/campuses.server';
import { slugifySegment } from '@/lib/utils/listing-path';

/** The market a new listing belongs to: the one named after the city of the agent's campus ("Nyeri" -> "nyeri"). */
export async function marketForAgentCampus(campusId?: string | null): Promise<string | undefined> {
  if (!campusId) return undefined;
  const campuses = await campusesServerApi.listServer('active,coming_soon,suspended').catch(() => []);
  const city = campuses.find((c) => c.id === campusId)?.city;
  return city ? slugifySegment(city) || undefined : undefined;
}
