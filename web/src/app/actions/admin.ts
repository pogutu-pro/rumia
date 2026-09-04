'use server';

import { createClient } from '@/lib/supabase/server';
import { adminApi } from '@/lib/api/admin';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { isAdminUser } from '@/lib/utils/admin';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import { generateAgentSlug, uniqueSlug } from '@/lib/utils/string';
import { sendPushToUser } from '@/lib/push';
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

/**
 * Resolves the campus to attach to a newly-created agent row.
 * Prefers the user's own profile campus (campus_id, then home_campus_id) so
 * promoted students keep their home campus. Falls back to the DeKUT campus
 * when no campus is recorded yet. `agents.campus_id` is NOT NULL.
 */
async function resolveAgentCampusId(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('campus_id, home_campus_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.campus_id || profile?.home_campus_id) {
    return profile.campus_id || profile.home_campus_id;
  }

  const { data: dekut } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('slug', 'dekut')
    .maybeSingle();

  return dekut?.id ?? null;
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
    const derivedEmail = `${sanitizedPhone}@agents.rumiamanage.com`;

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

    // Determine campus: agent's own if it has one, else DeKUT default
    const campusId = await resolveAgentCampusId(authData.user.id)
      ?? (await supabaseAdmin.from('campuses').select('id').eq('slug', 'dekut').maybeSingle()).data?.id
      ?? null;

    if (!campusId) {
      // Agent insert would fail on NOT NULL campus_id — clean up the orphaned Auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: 'No campus configured yet. Cannot create agent.' };
    }

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
      campus_id: campusId,
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

    // Auto-verify agent contacts against DeKUT official records
    try {
      const phoneResult = matchAgentToOfficialRecord(normalizedPhone, OFFICIAL_RECORDS);
      const whatsappResult = !phoneResult || phoneResult.state !== 'verified'
        ? matchAgentToOfficialRecord(normalizedWhatsapp, OFFICIAL_RECORDS)
        : phoneResult;
      const bestResult = phoneResult?.state === 'verified' ? phoneResult
        : whatsappResult?.state === 'verified' ? whatsappResult
        : null;
      if (bestResult?.state === 'verified') {
        const { data: createdAgent } = await supabaseAdmin
          .from('agents')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();
        if (createdAgent) {
          await supabaseAdmin
            .from('agents')
            .update({ verified: true })
            .eq('id', createdAgent.id);
        }
      }
    } catch {
      // Auto-verification is best-effort; ignore failures
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/users');

    // Notify all admins of the new agent
    import('@/lib/push').then(({ sendPushToUsers, getAdminUserIds }) =>
      getAdminUserIds().then((adminIds) => {
        if (adminIds.length > 0) {
          sendPushToUsers(adminIds, {
            title: 'New agent registered',
            body: `${data.name} was just added as an agent.`,
            url: '/admin/agents',
            tag: 'new-agent',
          }).catch(() => {});
        }
      }),
    );

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
    const { error } = await supabaseAdmin
      .from('listings')
      .update({ is_active: isActive })
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    revalidatePath('/hostels');
    revalidatePath('/');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Admin toggle for commission lock on a listing.
 * When locked, the agent cannot change the pays_commission setting.
 * Admin always has final authority over commission status.
 */
export async function toggleCommissionLockAction(
  listingId: string,
  locked: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('listings')
      .update({ commission_locked_by_admin: locked })
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
 * Admin override for pays_commission on a listing.
 * Admin can force a listing to pay or not pay commission,
 * regardless of the agent's setting.
 */
export async function setListingCommissionAction(
  listingId: string,
  paysCommission: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('listings')
      .update({ pays_commission: paysCommission })
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/dashboard');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Admin override for the landlord/caretaker phone on any listing.
 * Empty values intentionally clear the owner phone and restore runtime fallback.
 */
export async function updateListingOwnerPhoneAction(
  listingId: string,
  ownerPhone: string | null
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const cleaned = typeof ownerPhone === 'string' ? ownerPhone.trim() : '';
  if (cleaned && !isValidKenyanPhone(cleaned)) {
    return { success: false, error: 'Please enter a valid Kenyan owner phone number.' };
  }

  try {
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, slug, county, area')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const { error } = await supabaseAdmin
      .from('listings')
      .update({ landlord_phone: cleaned || null })
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/dashboard');
    revalidatePath(`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}`);
    if (listing.slug) {
      revalidatePath(`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`);
    }
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
    const { error } = await supabaseAdmin
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

    const campusId = await resolveAgentCampusId(userId);
    if (!campusId) {
      return { success: false, error: 'Cannot determine a campus for this user. Assign a campus to their profile first.' };
    }

    const { error: insertError } = await supabaseAdmin.from('agents').insert({
      name: data.name,
      phone: normalizedPhone,
      whatsapp: normalizedWhatsapp,
      user_id: userId,
      campus_id: campusId,
      status: 'active',
      slug,
    });

    if (insertError) {
      return { success: false, error: insertError.message ?? 'Failed to create agent record' };
    }

    // Auto-verify agent contacts against DeKUT official records
    try {
      const phoneResult = matchAgentToOfficialRecord(normalizedPhone, OFFICIAL_RECORDS);
      const whatsappResult = !phoneResult || phoneResult.state !== 'verified'
        ? matchAgentToOfficialRecord(normalizedWhatsapp, OFFICIAL_RECORDS)
        : phoneResult;
      const bestResult = phoneResult?.state === 'verified' ? phoneResult
        : whatsappResult?.state === 'verified' ? whatsappResult
        : null;
      if (bestResult?.state === 'verified') {
        const { data: createdAgent } = await supabaseAdmin
          .from('agents')
          .select('id')
          .eq('user_id', userId)
          .single();
        if (createdAgent) {
          await supabaseAdmin
            .from('agents')
            .update({ verified: true })
            .eq('id', createdAgent.id);
        }
      }
    } catch {
      // Auto-verification is best-effort; ignore failures
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
 * Updates a user's profile role. Admin can demote any privileged role back to
 * agent/student.
 *
 * Validates: Admin-only action
 */
export async function updateUserRoleAction(
  userId: string,
  newRole: 'student' | 'agent'
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/users');
    revalidatePath('/admin/managers');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Promotes an existing agent or manager to admin (root access). Only the
 * current admin can grant admin. Clears any manager scope since admins are
 * global super admins.
 *
 * Validates: Admin-only action
 */
export async function promoteToAdminAction(userId: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (userId === user.id) {
    return { success: false, error: 'You are already an admin' };
  }

  try {
    const { data: target, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError || !target) {
      return { success: false, error: 'User not found' };
    }

    if (target.role === 'admin') {
      return { success: false, error: 'User is already an admin' };
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin', managed_campus_id: null, managed_region_id: null })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/users');
    revalidatePath('/admin/managers');
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
  status: 'active' | 'suspended',
  suspensionReason?: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (status === 'suspended' && !suspensionReason?.trim()) {
    return { success: false, error: 'A suspension reason is required.' };
  }

  try {
    const updatePayload: Record<string, unknown> = { status };
    if (status === 'suspended') {
      updatePayload.suspension_reason = suspensionReason!.trim();
    } else {
      updatePayload.suspension_reason = null;
    }

    const { error } = await supabaseAdmin
      .from('agents')
      .update(updatePayload)
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Notify the agent of the status change
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('user_id, name')
      .eq('id', agentId)
      .single();

    if (agent?.user_id) {
      const label = status === 'active' ? 'reactivated' : 'suspended';
      sendPushToUser(agent.user_id, {
        title: `Account ${label}`,
        body: status === 'active'
          ? 'Your agent account has been reactivated. You can now post hostels again.'
          : `Your account has been suspended: ${suspensionReason}`,
        url: '/dashboard',
        tag: `agent-status-${agentId}`,
      }).catch(() => {});
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
 * Toggles the is_featured flag for an agent.
 * Featured agents appear first in the public directory and receive the
 * "Official Rumia Agent" card treatment.
 */
export async function toggleAgentFeaturedAction(
  agentId: string,
  featured: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('agents')
      .update({ is_featured: featured })
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/agents');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Toggles the is_founder flag for an agent.
 * Founder agents receive the "Founder" badge — separate from "Official".
 * Admin decides independently who gets each badge.
 */
export async function toggleAgentFounderAction(
  agentId: string,
  founder: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('agents')
      .update({ is_founder: founder })
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/agents');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Toggles the verified flag for an agent.
 * Verified agents have their contacts confirmed against DeKUT official records.
 */
export async function toggleAgentVerifiedAction(
  agentId: string,
  verified: boolean
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('agents')
      .update({ verified })
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/agents');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Updates an agent's customer-support team settings.
 * Controls whether the agent appears on the /verify (Hakikisha) page,
 * their rank within the support section, and whether they are the
 * platform owner (main support, unique hero card).
 *
 * is_owner is independent of `verified`: the owner can be main support
 * even before official records are fully verified.
 */
export async function updateAgentSupportAction(
  agentId: string,
  fields: {
    is_support?: boolean;
    support_rank?: number;
    is_owner?: boolean;
  }
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Setting a new owner clears the previous one (DB also enforces single-owner).
    if (fields.is_owner) {
      const { error: clearError } = await supabaseAdmin
        .from('agents')
        .update({ is_owner: false })
        .eq('is_owner', true);
      if (clearError) {
        return { success: false, error: clearError.message };
      }
    }

    const patch: Record<string, unknown> = {};
    if (typeof fields.is_support === 'boolean') patch.is_support = fields.is_support;
    if (typeof fields.support_rank === 'number') patch.support_rank = fields.support_rank;
    if (typeof fields.is_owner === 'boolean') patch.is_owner = fields.is_owner;

    const { error } = await supabaseAdmin
      .from('agents')
      .update(patch)
      .eq('id', agentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/agents');
    revalidatePath('/admin/support');
    revalidatePath('/verify');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Auto-verifies an agent's contacts against DeKUT official records.
 * Returns the verification result without modifying the agent.
 */
export async function verifyAgentAction(
  agentId: string
): Promise<ActionResult & {
  result?: {
    verified: boolean;
    matchedHostels: string[];
    sharedContactDetected: boolean;
  };
}> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { data: agent, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('id, phone, whatsapp')
      .eq('id', agentId)
      .single();

    if (fetchError || !agent) {
      return { success: false, error: 'Agent not found.' };
    }

    const phoneResult = matchAgentToOfficialRecord(agent.phone, OFFICIAL_RECORDS);
    const whatsappResult = !phoneResult || phoneResult.state !== 'verified'
      ? matchAgentToOfficialRecord(agent.whatsapp, OFFICIAL_RECORDS)
      : phoneResult;

    const bestResult = phoneResult?.state === 'verified' ? phoneResult
      : whatsappResult?.state === 'verified' ? whatsappResult
      : null;

    return {
      success: true,
      result: {
        verified: bestResult?.state === 'verified',
        matchedHostels: bestResult?.matchedHostels ?? [],
        sharedContactDetected: bestResult?.sharedContactDetected ?? false,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
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
 * Updates sort_position for multiple listings using a single set-based UPDATE
 * (reorder_listings RPC). Logs each change to listing_sort_history inside the
 * same atomic statement — no per-listing round trips.
 * Listings with sort_position set appear first, ordered ascending.
 * Null sort_position means "use default ordering" (created_at DESC).
 */
export async function updateListingsOrderAction(
  updates: Array<{ id: string; sort_position: number | null }>
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (updates.length === 0) {
    return { success: true };
  }

  try {
    const { error } = await supabaseAdmin.rpc('reorder_listings', {
      p_positions: updates.map((u) => ({
        listing_id: u.id,
        new_position: u.sort_position,
      })),
      p_admin_id: user.id,
    });

    if (error) {
      return { success: false, error: `Failed to save order: ${error.message}` };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    revalidatePath('/hostels');
    revalidatePath('/');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}

/**
 * Randomizes the listing order for the public /hostels page via the
 * shuffle_listing_order RPC. Every listing gets a fresh random sort_position
 * (1..N) so the line-up is a true shuffle, not newest-first.
 */
export async function shuffleListingsOrderAction(): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin.rpc('shuffle_listing_order', {
      p_admin_id: user.id,
    });

    if (error) {
      return { success: false, error: `Failed to shuffle listings: ${error.message}` };
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    revalidatePath('/hostels');
    revalidatePath('/');
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
  try {
    await adminApi.transferListingServer(listingId, newOwnerId);
    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to transfer listing' };
  }
}

/**
 * Admin-only action to update ANY listing, bypassing agent ownership checks.
 * Mirrors the agent's updateListingAction but uses supabaseAdmin.
 */
export async function adminUpdateListingAction(
  formData: any
): Promise<ActionResult & { listingId?: string; listingUrl?: string }> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  try {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('listings')
      .select('id, slug, county, area, price, agent_id')
      .eq('id', formData.listing_id)
      .single();

    if (existingError || !existing) {
      return { success: false, error: 'Listing not found.' };
    }

    const agentId = formData.agent_id || existing.agent_id;

    const payload = {
      title: formData.title,
      county: formData.county || 'nyeri',
      area: formData.area || 'dekut',
      description: formData.description,
      price:
        typeof formData.price === 'number'
          ? formData.price
          : parseFloat(formData.price || formData.price_single || formData.price_sharing) || null,
      location: formData.location,
      agent_id: agentId,
      youtube_id: formData.youtube_id || null,
      is_youtube_shorts: !!formData.is_youtube_shorts,
      is_active: formData.is_active,
      landlord_phone: formData.landlord_phone || null,
      room_type: formData.room_type,
      amenities: formData.amenities,
      bathroom_type: formData.bathroom_type,
      distance_to_campus: formData.distance_to_campus,
      security_type: formData.security_type,
      electricity_included: formData.electricity_included,
      water_included: formData.water_included,
      wifi_included: formData.wifi_included,
      latitude: nullableCoord(formData.latitude),
      longitude: nullableCoord(formData.longitude),
      gender: formData.gender || 'mixed',
      proximity_description: formData.proximity_description || '',
      specific_location: formData.specific_location || null,
      price_single:
        formData.price_single && parseInt(String(formData.price_single)) > 0
          ? parseInt(String(formData.price_single))
          : null,
      price_sharing:
        formData.price_sharing && parseInt(String(formData.price_sharing)) > 0
          ? parseInt(String(formData.price_sharing))
          : null,
      mpesa_details: formData.mpesa_details || null,
      distance_category: formData.distance_category || null,
    };

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .update(payload)
      .eq('id', existing.id)
      .select('id, slug, county, area')
      .single();

    if (listingError || !listing) {
      return {
        success: false,
        error: listingError?.message || 'Failed to update listing',
      };
    }

    // Replace images
    const { error: deleteImgError } = await supabaseAdmin
      .from('listing_images')
      .delete()
      .eq('listing_id', listing.id);

    if (deleteImgError) {
      return {
        success: false,
        error: 'Listing updated, but failed to clear old images',
      };
    }

    const images = formData.images || [];
    if (images.length > 0) {
      const imageInserts = images.map((img: any, idx: number) => ({
        listing_id: listing.id,
        r2_url: img.url,
        display_order: idx,
        category: img.category || 'Room',
        blur_data_url: img.blurDataUrl || img.blur_data_url || null,
        width: img.width || null,
        height: img.height || null,
        format: img.format || null,
        image_upload_id: img.imageUploadId || img.image_upload_id || null,
      }));
      const { error: insertImgError } = await supabaseAdmin
        .from('listing_images')
        .insert(imageInserts);
      if (insertImgError) {
        return {
          success: false,
          error: 'Listing updated, but failed to save some images',
        };
      }
    }

    // Replace room types
    const { error: deleteRtError } = await supabaseAdmin
      .from('listing_room_types')
      .delete()
      .eq('listing_id', listing.id);

    if (deleteRtError) {
      return {
        success: false,
        error: 'Listing updated, but failed to clear old room types',
      };
    }

    const roomTypes = formData.roomTypes || [];
    const validRoomTypes = roomTypes
      .filter((rt: any) => (rt.room_type || rt.category) && rt.price)
      .map((rt: any) => ({
        listing_id: listing.id,
        room_type: rt.room_type || rt.category,
        price: Math.round(parseFloat(rt.price)),
        is_available: rt.is_available,
        deposit:
          rt.deposit && parseInt(rt.deposit) > 0 ? parseInt(rt.deposit) : null,
        furnishing_items: rt.furnishing_items?.length
          ? rt.furnishing_items
          : null,
        category: rt.category || null,
        occupancy: rt.occupancy != null ? String(rt.occupancy) : null,
        floor: rt.floor || null,
        size: rt.size || null,
      }));

    if (validRoomTypes.length > 0) {
      const { error: insertRtError } = await supabaseAdmin
        .from('listing_room_types')
        .insert(validRoomTypes);
      if (insertRtError) {
        return {
          success: false,
          error: 'Listing updated, but failed to save some room types',
        };
      }
    }

    revalidatePath('/admin/listings');
    revalidatePath('/admin');
    revalidatePath('/hostels');
    revalidatePath('/');
    revalidatePath(
      `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`
    );

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

function nullableCoord(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── DeKUT Verification Actions ────────────────────────────────

import {
  parseOfficialRecord,
  verifyListingAgainstOfficial,
  buildOfficialPhoneIndex,
  matchAgentToOfficialRecord,
  type OfficialDeKutRecord,
  type ListingMatchCandidate,
} from '@/lib/utils/dekut-verification';
import officialRecordsData from '@/lib/data/dekut-official-records.json';

const OFFICIAL_RECORDS: OfficialDeKutRecord[] = officialRecordsData.map(
  (r) => parseOfficialRecord(r),
);

const OFFICIAL_PHONE_INDEX = buildOfficialPhoneIndex(OFFICIAL_RECORDS);

/**
 * Verify a single listing against the DeKUT official dataset.
 * Sets verification fields on the listing. Auto-verifies phone matches.
 * Name-only matches go to manual review. Never overwrites existing data silently.
 */
export async function verifyListingAction(
  listingId: string,
): Promise<
  ActionResult & {
    result?: {
      verified: boolean;
      match_type: string;
      matched_hostel: string | null;
      flags: string[];
    };
  }
> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('id, title, landlord_phone, agent_id, agents(id, phone, whatsapp)')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing) {
      return { success: false, error: 'Listing not found.' };
    }

    const listingRow = listing as any;
    const agentRow = Array.isArray(listingRow.agents)
      ? listingRow.agents[0]
      : listingRow.agents;

    const candidate: ListingMatchCandidate = {
      id: listingRow.id,
      title: listingRow.title,
      landlord_phone: listingRow.landlord_phone,
      agent_phone: agentRow?.phone ?? null,
      agent_whatsapp: agentRow?.whatsapp ?? null,
    };

    const result = verifyListingAgainstOfficial(
      candidate,
      OFFICIAL_RECORDS,
      OFFICIAL_PHONE_INDEX,
    );

    const updatePayload: Record<string, unknown> = {};

    if (!listingRow.verified) {
      updatePayload.verified = result.verified;
    }
    if (!listingRow.verified_source) {
      updatePayload.verified_source = result.verified_source;
    }
    if (!listingRow.verified_date) {
      updatePayload.verified_date = result.verified_date;
    }
    if (!listingRow.discrepancy_review_needed) {
      updatePayload.discrepancy_review_needed = result.discrepancy_review_needed;
    }
    if (!listingRow.shared_contact_detected) {
      updatePayload.shared_contact_detected = result.shared_contact_detected;
    }
    if (!listingRow.manual_review_needed) {
      updatePayload.manual_review_needed = result.manual_review_needed;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('listings')
        .update(updatePayload)
        .eq('id', listingId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath('/admin');

    return {
      success: true,
      result: {
        verified: result.verified,
        match_type: result.match_type,
        matched_hostel: result.matched_hostel,
        flags: result.flags,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Run verification across ALL listings.
 * Returns summary counts and detailed results.
 */
export async function verifyAllListingsAction(): Promise<
  ActionResult & {
    summary?: {
      total: number;
      matched: number;
      phone_verified: number;
      name_review: number;
      no_match: number;
      shared_contacts: number;
      official_no_listing: number;
    };
  }
> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { data: listings, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select(
        'id, title, landlord_phone, agent_id, agents(id, phone, whatsapp)',
      )
      .eq('is_active', true);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const candidates: ListingMatchCandidate[] = (listings || []).map((l: any) => ({
      id: l.id,
      title: l.title,
      landlord_phone: l.landlord_phone,
      agent_phone: Array.isArray(l.agents) ? l.agents[0]?.phone : l.agents?.phone,
      agent_whatsapp: Array.isArray(l.agents) ? l.agents[0]?.whatsapp : l.agents?.whatsapp,
    }));

    let phone_verified = 0;
    let name_review = 0;
    let no_match = 0;
    let shared_contacts = 0;

    const batchUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];

    for (const candidate of candidates) {
      const result = verifyListingAgainstOfficial(
        candidate,
        OFFICIAL_RECORDS,
        OFFICIAL_PHONE_INDEX,
      );

      const payload: Record<string, unknown> = {
        verified: result.verified,
        verified_source: result.verified_source,
        verified_date: result.verified_date,
        discrepancy_review_needed: result.discrepancy_review_needed,
        shared_contact_detected: result.shared_contact_detected,
        manual_review_needed: result.manual_review_needed,
      };

      batchUpdates.push({ id: candidate.id, payload });

      if (result.verified) phone_verified++;
      else if (result.manual_review_needed) name_review++;
      else no_match++;
      if (result.shared_contact_detected) shared_contacts++;
    }

    // Batch update in chunks of 50
    for (let i = 0; i < batchUpdates.length; i += 50) {
      const chunk = batchUpdates.slice(i, i + 50);
      const updates = chunk.map((u) =>
        supabaseAdmin
          .from('listings')
          .update(u.payload)
          .eq('id', u.id),
      );
      await Promise.all(updates);
    }

    // Count official records with no Rumia listing
    const officialPhoneIndex = buildOfficialPhoneIndex(OFFICIAL_RECORDS);
    let official_no_listing = 0;
    for (const record of OFFICIAL_RECORDS) {
      const hasMatch = candidates.some((c) => {
        const r = verifyListingAgainstOfficial(
          c,
          [record],
          officialPhoneIndex,
        );
        return r.matched_hostel !== null;
      });
      if (!hasMatch) official_no_listing++;
    }

    revalidatePath('/admin');

    return {
      success: true,
      summary: {
        total: candidates.length,
        matched: candidates.length - no_match,
        phone_verified,
        name_review,
        no_match,
        shared_contacts,
        official_no_listing,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Bulk verification failed',
    };
  }
}

/**
 * Toggle verification status on a listing directly by Admin.
 */
export async function toggleListingVerifiedAction(
  listingId: string,
  verified: boolean,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('listings')
      .update({
        verified,
        verified_source: verified ? 'Admin Manual Verification' : null,
        verified_date: verified ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', listingId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/listings');
    revalidatePath('/hostels');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to toggle listing verification' };
  }
}

/**
 * Fetch all official hostels from Supabase table dekut_official_hostels.
 */
export async function getOfficialHostelsAction(): Promise<
  ActionResult & { data?: any[] }
> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('dekut_official_hostels')
      .select('*')
      .order('hostel_name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch official hostels' };
  }
}

/**
 * Create a new official hostel record.
 */
export async function createOfficialHostelAction(payload: {
  hostel_name: string;
  zone: string;
  contacts: string;
  payments: string;
  source?: string;
}): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!payload.hostel_name?.trim() || !payload.zone?.trim()) {
    return { success: false, error: 'Hostel name and zone are required.' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('dekut_official_hostels')
      .insert({
        hostel_name: payload.hostel_name.trim(),
        zone: payload.zone.trim(),
        contacts: payload.contacts?.trim() || '',
        payments: payload.payments?.trim() || '',
        source: payload.source?.trim() || 'DeKUT Official Housing List',
        verified_date: new Date().toISOString().split('T')[0],
      });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/official-hostels');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create official hostel' };
  }
}

/**
 * Update an existing official hostel record.
 */
export async function updateOfficialHostelAction(
  id: string,
  payload: {
    hostel_name: string;
    zone: string;
    contacts: string;
    payments: string;
    source?: string;
  },
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!id || !payload.hostel_name?.trim() || !payload.zone?.trim()) {
    return { success: false, error: 'Missing required fields.' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('dekut_official_hostels')
      .update({
        hostel_name: payload.hostel_name.trim(),
        zone: payload.zone.trim(),
        contacts: payload.contacts?.trim() || '',
        payments: payload.payments?.trim() || '',
        source: payload.source?.trim() || 'DeKUT Official Housing List',
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/official-hostels');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update official hostel' };
  }
}

/**
 * Delete an official hostel record.
 */
export async function deleteOfficialHostelAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('dekut_official_hostels')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/official-hostels');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete official hostel' };
  }
}

/**
 * Seed official hostels from dekut-official-records.json into database table.
 */
export async function seedOfficialHostelsAction(): Promise<
  ActionResult & { seededCount?: number }
> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const recordsToInsert = officialRecordsData.map((r: any) => ({
      hostel_name: r.hostel_name,
      zone: r.zone || 'DeKUT',
      contacts: r.contacts || '',
      payments: r.payments || '',
      source: 'DeKUT Official Housing List',
      verified_date: '2026-07-14',
    }));

    const { error: rawInsertErr } = await supabaseAdmin
      .from('dekut_official_hostels')
      .insert(recordsToInsert);

    if (rawInsertErr) {
      return { success: false, error: rawInsertErr.message };
    }

    revalidatePath('/admin');
    revalidatePath('/admin/official-hostels');

    return { success: true, seededCount: recordsToInsert.length };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to seed official hostels' };
  }
}
