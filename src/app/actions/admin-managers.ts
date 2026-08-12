'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';
import { removeManagerRoleAction } from './staff';
import { revalidatePath } from 'next/cache';

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const isAdmin = await isAdminUser(supabase, user.id);
  return isAdmin ? user : null;
}

export async function adminRemoveManagerAction(userId: string) {
  const admin = await getAdminUser();
  if (!admin) {
    return { success: false, error: 'Unauthorized' };
  }

  const res = await removeManagerRoleAction(userId);
  if (res.success) {
    revalidatePath('/admin/managers');
  }
  return res;
}

export async function adminRevalidateManagersAction() {
  revalidatePath('/admin/managers');
  return { success: true };
}
