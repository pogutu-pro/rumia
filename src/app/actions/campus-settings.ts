'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getManagerUser } from './manager';
import { checkManagerCampusScope } from '@/lib/utils/manager';

export type CampusSettingsActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Updates campus settings. Managers can only update contact/social info.
 * Super Admins can update name, slug, region, and status.
 */
export async function updateCampusSettingsAction(
  campusId: string,
  data: {
    phone?: string | null;
    whatsapp?: string | null;
    whatsapp_number?: string | null;
    email?: string | null;
    social_links?: any | null;
    hero_headline?: string | null;
    hero_subtext?: string | null;
    primary_color?: string | null;
    short_name?: string | null;
    hero_image?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    twitter_description?: string | null;
    hostel_finding_fee?: number | null;
    // Admin only
    name?: string;
    slug?: string;
    region_id?: string | null;
    status?: 'active' | 'coming_soon';
  },
): Promise<CampusSettingsActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  // Authorization check
  const isAuthorized = await checkManagerCampusScope(
    supabaseAdmin,
    context,
    campusId,
  );
  if (!isAuthorized) {
    return {
      success: false,
      error:
        'Forbidden: You cannot modify settings for a campus you do not manage',
    };
  }

  // Zones are mandatory to complete campus settings: at least one hostel area
  // must exist for the campus before settings can be saved/finalized.
  const { count: zoneCount, error: zoneCountError } = await supabaseAdmin
    .from('campus_zones')
    .select('id', { count: 'exact', head: true })
    .eq('campus_id', campusId);

  if (zoneCountError) {
    return { success: false, error: 'Unable to verify hostel areas right now.' };
  }

  if (!zoneCount || zoneCount === 0) {
    return {
      success: false,
      error:
        'Add at least one hostel area (zone) before completing campus settings. Agents select these areas when listing hostels.',
    };
  }

  // Build update payload with allowed manager fields
  const updatePayload: any = {};
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.whatsapp !== undefined) updatePayload.whatsapp = data.whatsapp;
  if (data.whatsapp_number !== undefined)
    updatePayload.whatsapp_number = data.whatsapp_number;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.social_links !== undefined)
    updatePayload.social_links = data.social_links;
  if (data.hero_headline !== undefined)
    updatePayload.hero_headline = data.hero_headline;
  if (data.hero_subtext !== undefined)
    updatePayload.hero_subtext = data.hero_subtext;
  if (data.primary_color !== undefined)
    updatePayload.primary_color = data.primary_color;
  if (data.short_name !== undefined) updatePayload.short_name = data.short_name;
  if (data.seo_title !== undefined) updatePayload.seo_title = data.seo_title;
  if (data.seo_description !== undefined)
    updatePayload.seo_description = data.seo_description;
  if (data.og_title !== undefined) updatePayload.og_title = data.og_title;
  if (data.og_description !== undefined)
    updatePayload.og_description = data.og_description;
  if (data.twitter_description !== undefined)
    updatePayload.twitter_description = data.twitter_description;
  if (data.hero_image !== undefined) updatePayload.hero_image = data.hero_image;
  if (data.hostel_finding_fee !== undefined)
    updatePayload.hostel_finding_fee = data.hostel_finding_fee;

  // Additional fields allowed only for Super Admins
  if (context.isSuperAdmin) {
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.region_id !== undefined) updatePayload.region_id = data.region_id;
    if (data.status !== undefined) updatePayload.status = data.status;
  }

  const { error } = await supabaseAdmin
    .from('campuses')
    .update(updatePayload)
    .eq('id', campusId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/[campusSlug]', 'layout');
  revalidatePath('/');
  revalidateTag('campuses', 'page');

  return { success: true };
}

/**
 * Creates a new campus. Only Super Admins can do this.
 */
export async function createCampusAction(data: {
  name: string;
  slug: string;
  region_id: string;
  hero_image?: string | null;
}): Promise<CampusSettingsActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  if (!context.isSuperAdmin) {
    return {
      success: false,
      error: 'Forbidden: Only super admins can create campuses',
    };
  }

  const { error } = await supabaseAdmin.from('campuses').insert({
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    region_id: data.region_id,
    status: 'coming_soon', // New campuses are inactive by default
    hero_image: data.hero_image ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/');
  revalidateTag('campuses', 'page');
  return { success: true };
}
