import { apiFetch } from '../../lib/api/client';
import { listingCampusParams } from '../../lib/api/campuses';
import type { CampusZone } from '../../lib/api/schema';

export function fetchZones(campusId: string | null, campusSlug: string | null) {
  return apiFetch<CampusZone[]>('/zones', {
    params: listingCampusParams(campusId, campusSlug),
  });
}
