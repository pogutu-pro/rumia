'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdminUser } from '@/lib/utils/admin';
import { revalidatePath, revalidateTag } from 'next/cache';

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const isAdmin = await isAdminUser(supabase, user.id);
  return isAdmin ? user : null;
}

export async function adminCreateCampusAction(data: { name: string; city: string; slug: string; region_id: string }) {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { error } = await supabaseAdmin.from('campuses').insert({
      name: data.name,
      city: data.city,
      slug: data.slug,
      region_id: data.region_id,
      status: 'coming_soon',
      hero_headline: `Student Hostels Near ${data.name}`,
      whatsapp_number: '+254114845619',
      primary_color: '#10B981',
    });

    if (error) throw error;

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create campus' };
  }
}

export async function adminActivateCampusAction(campusId: string) {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { error } = await supabaseAdmin
      .from('campuses')
      .update({ status: 'active' })
      .eq('id', campusId);

    if (error) throw error;

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to activate campus' };
  }
}

export async function adminDeactivateCampusAction(campusId: string) {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { error } = await supabaseAdmin
      .from('campuses')
      .update({ status: 'coming_soon' })
      .eq('id', campusId);

    if (error) throw error;

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to deactivate campus' };
  }
}

export async function adminSuspendCampusAction(campusId: string) {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { error } = await supabaseAdmin
      .from('campuses')
      .update({ status: 'suspended' })
      .eq('id', campusId);

    if (error) throw error;

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to suspend campus' };
  }
}

export async function adminUpdateCampusAction(
  campusId: string,
  data: { name?: string; city?: string; slug?: string; region_id?: string }
) {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { error } = await supabaseAdmin
      .from('campuses')
      .update(data)
      .eq('id', campusId);

    if (error) throw error;

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    revalidateTag('campuses', 'max');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update campus' };
  }
}
