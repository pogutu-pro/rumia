import type { SupabaseClient } from '@supabase/supabase-js';

export interface ManagerUserContext {
  userId: string;
  role: 'manager' | 'admin';
  managedCampusId: string | null;
  managedRegionId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Checks whether a given user ID has a manager or admin role.
 * Returns the manager context if authorized, or null if unauthorized.
 */
export async function getManagerUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ManagerUserContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, managed_campus_id, managed_region_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || !profile.role) return null;

  const role = profile.role as string;
  const isSuperAdmin = role === 'admin';
  const isManager = role === 'manager';

  if (!isSuperAdmin && !isManager) {
    return null;
  }

  return {
    userId,
    role: role as 'manager' | 'admin',
    managedCampusId: profile.managed_campus_id || null,
    managedRegionId: profile.managed_region_id || null,
    isSuperAdmin,
  };
}

/**
 * Helper to check if a user is a manager or admin.
 */
export async function isManagerUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const context = await getManagerUserContext(supabase, userId);
  return context !== null;
}

/**
 * Helper to check if a manager is authorized to access data for a specific campus_id.
 * Evaluates both managedCampusId and managedRegionId.
 */
export async function checkManagerCampusScope(
  supabase: SupabaseClient,
  context: ManagerUserContext,
  targetCampusId: string
): Promise<boolean> {
  if (context.isSuperAdmin) return true;

  if (context.managedCampusId && context.managedCampusId === targetCampusId) {
    return true;
  }

  if (context.managedRegionId) {
    const { data: campus } = await supabase
      .from('campuses')
      .select('region_id')
      .eq('id', targetCampusId)
      .maybeSingle();
      
    if (campus && campus.region_id === context.managedRegionId) {
      return true;
    }
  }

  return false;
}
