import { apiFetch } from './client';
import type { Campus } from './schema';

export const DEFAULT_CAMPUS_SLUG = 'dekut';

export function fetchCampuses() {
  return apiFetch<Campus[]>('/campuses');
}

export function listingCampusParams(campusId: string | null, campusSlug: string | null) {
  if (campusId) {
    return { campus_id: campusId };
  }

  return { campus_slug: campusSlug || DEFAULT_CAMPUS_SLUG };
}
