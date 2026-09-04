'use server';

import { adminApi } from '@/lib/api/admin';
import { revalidatePath } from 'next/cache';

export async function adminRemoveManagerAction(userId: string) {
  try {
    await adminApi.removeManagerServer(userId);
    revalidatePath('/admin/managers');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to remove manager' };
  }
}

export async function adminRevalidateManagersAction() {
  revalidatePath('/admin/managers');
  return { success: true };
}
