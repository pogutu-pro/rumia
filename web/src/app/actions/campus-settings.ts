'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { managerApi, type CampusSettingsPayload } from '@/lib/api/manager';

export type CampusSettingsActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof ApiError ? err.message || fallback : fallback };
}

/**
 * Updates campus settings. Managers may change contact/branding/fee fields of campuses they
 * manage (at least one hostel area must exist); name/slug/region/status are admin-only and are
 * ignored by FastAPI for managers.
 */
export async function updateCampusSettingsAction(
  campusId: string,
  data: CampusSettingsPayload & { whatsapp?: string | null },
): Promise<CampusSettingsActionResult> {
  // `whatsapp` is a legacy alias: the real column is `whatsapp_number`.
  const { whatsapp, ...payload } = data;
  void whatsapp;
  try {
    await managerApi.updateCampus(campusId, payload);
    revalidatePath('/manager/settings');
    revalidatePath('/[campusSlug]', 'layout');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to update campus settings');
  }
}

/** Creates a campus (admin only). It starts as coming_soon. */
export async function createCampusAction(data: {
  name: string;
  slug: string;
  region_id: string;
  hero_image?: string | null;
}): Promise<CampusSettingsActionResult> {
  try {
    await managerApi.createCampus({
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      region_id: data.region_id,
      hero_image: data.hero_image ?? null,
    });
    revalidatePath('/manager/settings');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to create the campus');
  }
}
