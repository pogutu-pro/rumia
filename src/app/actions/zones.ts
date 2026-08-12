'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getManagerUser } from './manager';
import { checkManagerCampusScope } from '@/lib/utils/manager';
import { slugify } from '@/lib/utils/string';

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

/**
 * Resolves a slug for a new/renamed zone that is unique within the campus.
 * `campus_zones.slug` is NOT NULL and constrained by UNIQUE(campus_id, slug),
 * so the slug is generated server-side (never trusted from the client).
 */
async function uniqueZoneSlug(
  campusId: string,
  name: string,
  excludeZoneId?: string,
): Promise<{ slug: string; error?: string }> {
  const base = slugify(name);
  if (!base) {
    return { slug: '', error: 'Zone name must contain letters or numbers.' };
  }

  let query = supabaseAdmin
    .from('campus_zones')
    .select('slug')
    .eq('campus_id', campusId);
  if (excludeZoneId) {
    query = query.neq('id', excludeZoneId);
  }
  const { data: existing, error } = await query;

  if (error) {
    return { slug: '', error: error.message };
  }

  const taken = new Set((existing || []).map((z) => z.slug));
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n++}`;
  }
  return { slug };
}

/**
 * Creates a new campus zone.
 */
export async function createZoneAction(
  campusId: string,
  name: string,
  fullSearchPrice: number,
  distanceCategory?: string | null,
): Promise<ZoneActionResult<ZoneRow>> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      campusId,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error:
          'Forbidden: You cannot create zones for a campus you do not manage',
      };
    }
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: 'Zone name is required.' };
  }

  const { slug, error: slugError } = await uniqueZoneSlug(campusId, trimmedName);
  if (slugError) {
    return { success: false, error: slugError };
  }

  const { data, error } = await supabaseAdmin
    .from('campus_zones')
    .insert({
      campus_id: campusId,
      name: trimmedName,
      slug,
      full_search_price: fullSearchPrice,
      distance_category: distanceCategory ?? null,
    })
    .select(
      'id, campus_id, name, slug, distance_category, full_search_price',
    )
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/manager/zones');
  revalidatePath('/[campusSlug]', 'layout');

  return { success: true, data: data as ZoneRow };
}

/**
 * Updates an existing campus zone.
 */
export async function updateZoneAction(
  zoneId: string,
  name: string,
  fullSearchPrice: number,
  distanceCategory?: string | null,
): Promise<ZoneActionResult<ZoneRow>> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  // Fetch the zone to check campus_id
  const { data: zone, error: fetchError } = await supabaseAdmin
    .from('campus_zones')
    .select('id, campus_id, name, slug')
    .eq('id', zoneId)
    .single();

  if (fetchError || !zone) {
    return { success: false, error: 'Zone not found' };
  }

  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      zone.campus_id,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error:
          'Forbidden: You cannot update zones for a campus you do not manage',
      };
    }
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: 'Zone name is required.' };
  }

  // Regenerate the slug when the name changes so URLs stay canonical.
  let slug = zone.slug;
  const newBase = slugify(trimmedName);
  if (newBase && newBase !== zone.slug) {
    const { slug: nextSlug, error: slugError } = await uniqueZoneSlug(
      zone.campus_id,
      trimmedName,
      zoneId,
    );
    if (slugError) {
      return { success: false, error: slugError };
    }
    slug = nextSlug;
  }

  const { data, error } = await supabaseAdmin
    .from('campus_zones')
    .update({
      name: trimmedName,
      slug,
      full_search_price: fullSearchPrice,
      distance_category: distanceCategory ?? null,
    })
    .eq('id', zoneId)
    .select(
      'id, campus_id, name, slug, distance_category, full_search_price',
    )
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/manager/zones');
  revalidatePath('/[campusSlug]', 'layout');

  return { success: true, data: data as ZoneRow };
}

/**
 * Deletes a campus zone.
 *
 * Guards against destroying live product data: a zone that is still referenced
 * by listings (listings.area stores the canonical zone name) cannot be deleted.
 */
export async function deleteZoneAction(zoneId: string): Promise<ZoneActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  // Fetch the zone to check campus_id
  const { data: zone, error: fetchError } = await supabaseAdmin
    .from('campus_zones')
    .select('id, campus_id, name')
    .eq('id', zoneId)
    .single();

  if (fetchError || !zone) {
    return { success: false, error: 'Zone not found' };
  }

  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      zone.campus_id,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error:
          'Forbidden: You cannot delete zones for a campus you do not manage',
      };
    }
  }

  // Prevent destructive deletion of a zone still in use by live listings.
  const { count } = await supabaseAdmin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('campus_id', zone.campus_id)
    .eq('area', zone.name);

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete "${zone.name}": ${count} hostel listing${count === 1 ? '' : 's'} still use this area. Rename it instead, or remove the listings first.`,
    };
  }

  const { error } = await supabaseAdmin
    .from('campus_zones')
    .delete()
    .eq('id', zoneId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/manager/zones');
  revalidatePath('/[campusSlug]', 'layout');

  return { success: true };
}
