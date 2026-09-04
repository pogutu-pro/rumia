'use server';

import { adminApi } from '@/lib/api/admin';
import { revalidatePath } from 'next/cache';

export async function adminCreateCampusAction(data: { name: string; city: string; slug: string; region_id: string }) {
  try {
    await adminApi.createCampusServer({
      name: data.name,
      city: data.city,
      slug: data.slug,
      region_id: data.region_id,
      status: 'coming_soon',
      hero_headline: `Student Hostels Near ${data.name}`,
      whatsapp_number: '+254114845619',
      primary_color: '#10B981',
    });

    revalidatePath('/admin/campuses');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to create campus' };
  }
}

export async function adminActivateCampusAction(campusId: string) {
  try {
    await adminApi.updateCampusStatusServer(campusId, 'active');
    revalidatePath('/admin/campuses');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to activate campus' };
  }
}

export async function adminDeactivateCampusAction(campusId: string) {
  try {
    await adminApi.updateCampusStatusServer(campusId, 'coming_soon');
    revalidatePath('/admin/campuses');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to deactivate campus' };
  }
}

export async function adminSuspendCampusAction(campusId: string) {
  try {
    await adminApi.updateCampusStatusServer(campusId, 'suspended');
    revalidatePath('/admin/campuses');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to suspend campus' };
  }
}

export async function adminUpdateCampusAction(
  campusId: string,
  data: { name?: string; city?: string; slug?: string; region_id?: string }
) {
  try {
    await adminApi.updateCampusServer(campusId, data);
    revalidatePath('/admin/campuses');
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update campus' };
  }
}
