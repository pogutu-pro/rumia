'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { isAdminUser } from '@/lib/utils/admin';
import { generateAgentSlug, uniqueSlug } from '@/lib/utils/string';
import type { CreateAgentInput, CreateCommissionInput } from '@/types';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Returns a Supabase admin client using the service role key.
 * Required for supabase.auth.admin.* operations.
 */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0') && cleaned.length > 1) {
    return '+254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('254') && !cleaned.startsWith('+')) {
    return '+' + cleaned;
  }
  if (!cleaned.startsWith('+')) {
    return '+254' + cleaned;
  }
  return cleaned;
}

function getAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin configuration');
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Validates the current session and returns the user if they are an admin.
 * Returns null if the session is missing or the user is not an admin.
 */
async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const isAdmin = await isAdminUser(supabase, user.id);

  if (!isAdmin) {
    return null;
  }

  return user;
}

/**
 * Creates a Supabase Auth user and a linked agent record.
 * If Auth user creation fails, the agent row is NOT inserted (no orphaned records).
 *
 * Validates: Requirements 1.1, 1.3, 7.3, 7.4
 */
export async function createAgentAction(
  data: CreateAgentInput
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Derive email from phone: strip non-alphanumeric chars, append domain
    const sanitizedPhone = data.phone.replace(/[^a-zA-Z0-9]/g, '');
    const derivedEmail = `${sanitizedPhone}@agents.rumia.co.ke`;

    // Generate a random password using crypto.randomUUID
    const password = crypto.randomUUID();

    // Create Supabase Auth user first (requires service role key)
    const adminSupabase = getAdminSupabaseClient();
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: derivedEmail,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message ?? 'Failed to create agent account',
      };
    }

    // Auth user created — now insert the agent row (use admin client to bypass RLS)
    const normalizedPhone = normalizePhone(data.phone);
    const normalizedWhatsapp = normalizePhone(data.whatsapp);

    // Generate unique slug from agent name
    const baseSlug = generateAgentSlug(data.name);
    const slug = await uniqueSlug(baseSlug, async (s) => {
      const { data: existing } = await supabaseAdmin.from('agents').select('id').eq('slug', s).maybeSingle();
      return !!existing;
    });

    const { error: insertError } = await supabaseAdmin.from('agents').insert({
      name: data.name,
      phone: normalizedPhone,
      whatsapp: normalizedWhatsapp,
      user_id: authData.user.id,
      status: 'active',
      slug,
    });

    if (insertError) {
      // Agent insert failed — attempt to clean up the orphaned Auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return {
        success: false,
        error: insertError.message ?? 'Failed to create agent record',
      };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Sets a listing's is_active flag.
 *
 * Validates: Requirements 8.3, 9.7
 */
export async function updateListingActiveAction(
  listingId: string,
  isActive: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('listings')
      .update({ is_active: isActive })
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Permanently deletes a listing record.
 *
 * Validates: Requirements 9.5, 9.6
 */
export async function deleteListingAction(
  listingId: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/listings');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Creates a commission record with status 'pending'.
 *
 * Validates: Requirements 10.10, 11.4
 */
export async function createCommissionAction(
  data: CreateCommissionInput
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('commissions').insert({
      agent_id: data.agent_id,
      listing_id: data.listing_id,
      amount: data.amount,
      status: 'pending',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/commissions');
    revalidatePath('/admin/leads');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Promotes an existing student to an agent by creating an agent record
 * linked to their existing auth user. Does NOT create a new auth user.
 */
export async function promoteStudentToAgentAction(
  userId: string,
  data: { name: string; phone: string; whatsapp: string }
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const normalizedPhone = normalizePhone(data.phone);
    const normalizedWhatsapp = normalizePhone(data.whatsapp);

    const baseSlug = generateAgentSlug(data.name);
    const slug = await uniqueSlug(baseSlug, async (s) => {
      const { data: existing } = await supabaseAdmin.from('agents').select('id').eq('slug', s).maybeSingle();
      return !!existing;
    });

    const { error: insertError } = await supabaseAdmin.from('agents').insert({
      name: data.name,
      phone: normalizedPhone,
      whatsapp: normalizedWhatsapp,
      user_id: userId,
      status: 'active',
      slug,
    });

    if (insertError) {
      return { success: false, error: insertError.message ?? 'Failed to create agent record' };
    }

    // Also update profile role to 'agent'
    const { error: roleError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', userId);

    if (roleError) {
      return { success: false, error: roleError.message };
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/agents');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Updates a user's profile role. Admins can promote agents to admin,
 * or demote admins back to agent.
 *
 * Validates: Admin-only action
 */
export async function updateUserRoleAction(
  userId: string,
  newRole: 'student' | 'agent' | 'admin'
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Updates an agent's status to 'active' or 'suspended'.
 */
export async function updateAgentStatusAction(
  agentId: string,
  status: 'active' | 'suspended'
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('agents')
      .update({ status })
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath(`/admin/agents/${agentId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Updates an agent's name, phone, and/or whatsapp.
 */
export async function updateAgentAction(
  agentId: string,
  data: { name?: string; phone?: string; whatsapp?: string }
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const updateData: Record<string, string> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = normalizePhone(data.phone);
    if (data.whatsapp !== undefined) updateData.whatsapp = normalizePhone(data.whatsapp);

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const { error } = await supabaseAdmin
      .from('agents')
      .update(updateData)
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath(`/admin/agents/${agentId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Marks a commission as paid and records the paid timestamp.
 *
 * NOTE: The `commissions` table must have the `paid_at` column. If it doesn't
 * exist yet, run the following migration in Supabase:
 *   ALTER TABLE commissions ADD COLUMN IF NOT EXISTS paid_at timestamptz;
 *
 * Validates: Requirements 8.6, 11.4, 12.8
 */
export async function markCommissionPaidAction(
  commissionId: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', commissionId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/commissions');
    revalidatePath('/admin/agents');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Transfers a hostel listing from its current owner to a new agent.
 * Records the transfer in transfer_history for audit trail.
 */
export async function transferListingAction(
  listingId: string,
  newOwnerId: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Validate: new owner must be an active agent
    const { data: newOwner, error: ownerError } = await supabaseAdmin
      .from('agents')
      .select('id, name, status')
      .eq('id', newOwnerId)
      .single();

    if (ownerError || !newOwner) {
      return { success: false, error: 'Selected agent not found' };
    }

    if (newOwner.status !== 'active') {
      return { success: false, error: 'Cannot transfer to a suspended or inactive agent' };
    }

    // Get current listing to find previous owner
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, agent_id')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    // Prevent transfer to same owner
    if (listing.agent_id === newOwnerId) {
      return { success: false, error: 'Listing already belongs to this agent' };
    }

    // Update listing ownership (only agent_id changes, all other data preserved)
    const { error: updateError } = await supabaseAdmin
      .from('listings')
      .update({ agent_id: newOwnerId })
      .eq('id', listingId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Record audit trail
    const { error: historyError } = await supabaseAdmin
      .from('transfer_history')
      .insert({
        listing_id: listingId,
        previous_owner_id: listing.agent_id,
        new_owner_id: newOwnerId,
        transferred_by: user.id,
      });

    if (historyError) {
      console.error('Failed to record transfer history:', historyError);
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}
