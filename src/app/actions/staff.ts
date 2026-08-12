'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getManagerUser } from './manager';

export type StaffActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Assigns or updates a manager's access. Admin (super admin) promotes an
 * existing agent to manager by setting the manager role + scope. Only the
 * single admin user can do this.
 */
export async function assignManagerRoleAction(
  userId: string,
  data: {
    role: 'manager';
    managed_campus_id?: string | null;
    managed_region_id?: string | null;
  }
): Promise<StaffActionResult> {
  const manager = await getManagerUser();
  if (!manager || !manager.context.isSuperAdmin) {
    return { success: false, error: 'Unauthorized: Admin role required' };
  }

  // Enforce mutually exclusive constraints (already at DB level, but good for UX)
  if (data.managed_campus_id && data.managed_region_id) {
    return { success: false, error: 'A manager cannot have both a campus and a region assigned.' };
  }

  const updatePayload = {
    role: 'manager' as const,
    managed_campus_id: data.managed_campus_id || null,
    managed_region_id: data.managed_region_id || null,
  };

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true };
}

/**
 * Removes manager access (downgrades back to agent). Only Super Admins can do this.
 * Managers are promoted from the agent pool, so removal reverts the role to
 * 'agent' (the pre-promotion state) rather than stripping agent standing.
 */
export async function removeManagerRoleAction(userId: string): Promise<StaffActionResult> {
  const manager = await getManagerUser();
  if (!manager || !manager.context.isSuperAdmin) {
    return { success: false, error: 'Unauthorized: Super Admin role required' };
  }

  // Prevent self-demotion
  if (userId === manager.user.id) {
    return { success: false, error: 'Cannot demote yourself' };
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      role: 'agent',
      managed_campus_id: null,
      managed_region_id: null,
    })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true };
}

/**
 * Finds a user by email to assign as manager.
 */
export async function findUserByEmailAction(email: string): Promise<StaffActionResult<{ id: string; email: string; full_name: string }>> {
  const manager = await getManagerUser();
  if (!manager || !manager.context.isSuperAdmin) {
    return { success: false, error: 'Unauthorized: Super Admin role required' };
  }

  // Search by email is tricky without auth admin API or a separate profiles view.
  // Assuming profiles has email or we can search auth.users? Wait, profiles does not have email.
  // Actually, wait, does profiles have email? I'll need to check the schema.
  // Often it's safer to just search by full_name or email if we stored it.
  // Since we don't have full schema, I'll assume we can search auth.users via admin.

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    return { success: false, error: error.message };
  }

  const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (!targetUser) {
    return { success: false, error: 'User not found with this email' };
  }

  // Get profile to return full name
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', targetUser.id)
    .single();

  return { 
    success: true, 
    data: { 
      id: targetUser.id, 
      email: targetUser.email || '',
      full_name: profile?.full_name || 'Unknown' 
    } 
  };
}

/**
 * Searches existing agents (agents table joined to their profiles) so a manager
 * can be promoted from the agent pool. Only accounts that already hold the
 * `agent` role are returned. Only Super Admins can do this.
 */
export async function searchAgentsToPromoteAction(
  query: string
): Promise<StaffActionResult<{ id: string; email: string; full_name: string; campus_name: string }[]>> {
  const manager = await getManagerUser();
  if (!manager || !manager.context.isSuperAdmin) {
    return { success: false, error: 'Unauthorized: Super Admin role required' };
  }

  const term = query.trim().toLowerCase();
  if (term.length < 2) {
    return { success: true, data: [] };
  }

  // Agents are surfaced from profiles (the auth-backed identity) joined to the
  // campuses table via profiles.campus_id so we can show which campus they
  // belong to. We never surface arbitrary non-agent emails for promotion.
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      campi:campuses(id, name)
    `)
    .eq('role', 'agent')
    .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
    .limit(20);

  if (error) {
    return { success: false, error: error.message };
  }

  const results = (data || []).map((p: any) => ({
    id: p.id,
    email: p.email || '',
    full_name: p.full_name || 'Unknown',
    campus_name: (p.campi as any[])?.[0]?.name || 'Unknown campus',
  }));

  return { success: true, data: results };
}
