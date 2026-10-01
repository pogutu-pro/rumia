'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { managerApi } from '@/lib/api/manager';

export type ZoneActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

type ZoneRow = {
  id: string;
  campus_id: string;
  name: string;
  slug: string;
  distance_category: string | null;
  full_search_price: number;
};

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof ApiError ? err.message || fallback : fallback };
}

function revalidateZoneSurfaces() {
  revalidatePath('/manager/settings');
  revalidatePath('/manager/zones');
  revalidatePath('/[campusSlug]', 'layout');
}

/** Creates a campus zone (slug generated server-side; campus scope enforced by FastAPI). */
export async function createZoneAction(
  campusId: string,
  name: string,
  fullSearchPrice: number,
  distanceCategory?: string | null,
): Promise<ZoneActionResult<ZoneRow>> {
  if (!name.trim()) return { success: false, error: 'Zone name is required.' };
  try {
    const data = await managerApi.createZone(campusId, name.trim(), fullSearchPrice, distanceCategory);
    revalidateZoneSurfaces();
    return { success: true, data: data as unknown as ZoneRow };
  } catch (err) {
    return failure(err, 'Failed to create the zone');
  }
}

/** Updates a zone; renaming regenerates its slug. */
export async function updateZoneAction(
  zoneId: string,
  name: string,
  fullSearchPrice: number,
  distanceCategory?: string | null,
): Promise<ZoneActionResult<ZoneRow>> {
  if (!name.trim()) return { success: false, error: 'Zone name is required.' };
  try {
    const data = await managerApi.updateZone(zoneId, name.trim(), fullSearchPrice, distanceCategory);
    revalidateZoneSurfaces();
    return { success: true, data: data as unknown as ZoneRow };
  } catch (err) {
    return failure(err, 'Failed to update the zone');
  }
}

/** Deletes a zone; refused while listings still use it. */
export async function deleteZoneAction(zoneId: string): Promise<ZoneActionResult> {
  try {
    await managerApi.deleteZone(zoneId);
    revalidateZoneSurfaces();
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete the zone');
  }
}
