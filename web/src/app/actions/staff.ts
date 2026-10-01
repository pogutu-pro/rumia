'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { managerApi } from '@/lib/api/manager';

export type StaffActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof ApiError ? err.message || fallback : fallback };
}

/** Promote an existing agent to manager with a campus OR region scope (admin only, enforced by FastAPI). */
export async function assignManagerRoleAction(
  userId: string,
  data: {
    role: 'manager';
    managed_campus_id?: string | null;
    managed_region_id?: string | null;
  },
): Promise<StaffActionResult> {
  if (data.managed_campus_id && data.managed_region_id) {
    return { success: false, error: 'A manager cannot have both a campus and a region assigned.' };
  }
  try {
    await managerApi.assignManager(userId, {
      managed_campus_id: data.managed_campus_id || null,
      managed_region_id: data.managed_region_id || null,
    });
    revalidatePath('/manager/staff');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to assign the manager role');
  }
}

/** Remove manager access (reverts the role to agent). Admin only; you cannot demote yourself. */
export async function removeManagerRoleAction(userId: string): Promise<StaffActionResult> {
  try {
    await managerApi.removeManager(userId);
    revalidatePath('/manager/staff');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to remove the manager role');
  }
}

/** Find a user by email (admin only). */
export async function findUserByEmailAction(
  email: string,
): Promise<StaffActionResult<{ id: string; email: string; full_name: string }>> {
  try {
    const user = await managerApi.findUser(email);
    return { success: true, data: { ...user, full_name: user.full_name || 'Unknown' } };
  } catch (err) {
    return failure(err, 'User not found with this email');
  }
}

/** Search existing agents who can be promoted to manager (admin only). */
export async function searchAgentsToPromoteAction(
  query: string,
): Promise<StaffActionResult<{ id: string; email: string; full_name: string; campus_name: string }[]>> {
  if (query.trim().length < 2) return { success: true, data: [] };
  try {
    return { success: true, data: await managerApi.searchAgents(query.trim()) };
  } catch (err) {
    return failure(err, 'Search failed');
  }
}
