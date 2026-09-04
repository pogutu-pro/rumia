'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getManagerUserContext, type ManagerUserContext, checkManagerCampusScope } from '@/lib/utils/manager';
import { cleanPhone, isValidKenyanPhone } from '@/lib/utils/phone';
import { generateAgentSlug, uniqueSlug } from '@/lib/utils/string';
import { normalizeCampusAreaSelection } from '@/lib/utils/campus-zones';
import { sendPushToUser } from '@/lib/push';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

export type ManagerActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Validates the current session and returns the manager context if user is a manager or admin.
 * Returns null if session is missing or user does not have manager/admin privileges.
 */
export async function getManagerUser(): Promise<{
  user: { id: string; email?: string };
  context: ManagerUserContext;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const context = await getManagerUserContext(supabase, user.id);

  if (!context) {
    return null;
  }

  return {
    user: { id: user.id, email: user.email },
    context,
  };
}

/**
 * Fetches applications scoped strictly to the manager's managed_campus_id
 * (or all applications if admin).
 */
export async function getManagerApplicationsAction() {
  const manager = await getManagerUser();
  if (!manager) return [];

  const { context } = manager;
  const supabase = await createClient();

  let query = supabase
    .from('agent_applications')
    .select(`
      id,
      user_id,
      campus_id,
      full_name,
      phone,
      id_number,
      hostel_name,
      relationship_to_hostel,
      owner_contact,
      status,
      rejection_reason,
      reviewed_by,
      reviewed_at,
      created_at,
      campuses (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  // Explicit campus/region scoping for managers
  if (!context.isSuperAdmin) {
    let allowedCampusIds: string[] = [];
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabase.from('campuses').select('id').eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map(c => c.id);
      }
    }

    if (allowedCampusIds.length === 0) {
      return [];
    }
    query = query.in('campus_id', allowedCampusIds);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Approves a pending agent application.
 * Actions taken:
 * 1. Checks manager authorization and campus scope.
 * 2. Promotes user profile role from 'student' to 'agent'. (STRICT BOUNDARY: role can only be set to 'agent')
 * 3. Creates an active row in the `agents` table.
 * 4. Marks `agent_applications` status = 'approved'.
 */
export async function approveAgentApplicationAction(
  applicationId: string
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;

  // Fetch target application
  const { data: app, error: appError } = await supabaseAdmin
    .from('agent_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (appError || !app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'pending') {
    return { success: false, error: 'Application has already been processed' };
  }

  // Campus/Region Scope Authorization Check
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(supabaseAdmin, context, app.campus_id);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot approve applications for a campus you do not manage',
      };
    }
  }

  try {
    const normalizedPhone = cleanPhone(app.phone);

    // Generate unique slug for agent
    const baseSlug = generateAgentSlug(app.full_name);
    const slug = await uniqueSlug(baseSlug, async (s) => {
      const { data: existing } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('slug', s)
        .maybeSingle();
      return !!existing;
    });

    // 1. Create row in `agents` table
    const { error: agentInsertError } = await supabaseAdmin.from('agents').insert({
      user_id: app.user_id,
      campus_id: app.campus_id,
      name: app.full_name,
      phone: normalizedPhone,
      whatsapp: normalizedPhone,
      status: 'active',
      slug,
    });

    if (agentInsertError) {
      return {
        success: false,
        error: agentInsertError.message || 'Failed to create agent profile record',
      };
    }

    // 2. Promote user's role on profiles — STRICT BOUNDARY: strictly set to 'agent'
    const newRole: 'agent' = 'agent';
    const { error: roleError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole }) // Role strictly hardcoded to 'agent'
      .eq('id', app.user_id);

    if (roleError) {
      return { success: false, error: roleError.message || 'Failed to update user role' };
    }

    // 3. Mark application as approved
    const { error: updateAppError } = await supabaseAdmin
      .from('agent_applications')
      .update({
        status: 'approved',
        reviewed_by: manager.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateAppError) {
      return { success: false, error: updateAppError.message };
    }

    revalidatePath('/manager/applications');
    revalidatePath('/manager/agents');
    revalidatePath('/account');

    // Notify applicant
    sendPushToUser(app.user_id, {
      title: 'Agent Application Approved!',
      body: `Congratulations! Your application to become a Rumia agent for ${app.hostel_name} has been approved.`,
      url: '/dashboard',
      tag: `app-approved-${applicationId}`,
    }).catch(() => {});

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error during approval';
    return { success: false, error: msg };
  }
}

/**
 * Rejects a pending agent application with a specified reason.
 * Role on user's profile remains unchanged.
 */
export async function rejectAgentApplicationAction(
  applicationId: string,
  rejectionReason: string
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;
  const reason = rejectionReason?.trim();
  if (!reason) {
    return { success: false, error: 'Rejection reason is required' };
  }

  // Fetch target application
  const { data: app, error: appError } = await supabaseAdmin
    .from('agent_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (appError || !app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'pending') {
    return { success: false, error: 'Application has already been processed' };
  }

  // Campus/Region Scope Authorization Check
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(supabaseAdmin, context, app.campus_id);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot reject applications for a campus you do not manage',
      };
    }
  }

  // Mark application as rejected
  const { error: updateAppError } = await supabaseAdmin
    .from('agent_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: manager.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (updateAppError) {
    return { success: false, error: updateAppError.message };
  }

  revalidatePath('/manager/applications');
  revalidatePath('/account');

  // Notify applicant
  sendPushToUser(app.user_id, {
    title: 'Agent Application Status Update',
    body: `Your agent application for ${app.hostel_name} was not approved. Reason: ${reason}`,
    url: '/account?tab=agent-application',
    tag: `app-rejected-${applicationId}`,
  }).catch(() => {});

  return { success: true };
}

/**
 * Fetches agents scoped strictly to the manager's campus.
 */
export async function getManagerAgentsAction() {
  const manager = await getManagerUser();
  if (!manager) return [];

  const { context } = manager;
  const supabase = await createClient();

  let query = supabase
    .from('agents')
    .select(`
      id,
      user_id,
      campus_id,
      name,
      phone,
      whatsapp,
      status,
      verified,
      is_featured,
      is_founder,
      slug,
      created_at,
      campuses (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (!context.isSuperAdmin) {
    let allowedCampusIds: string[] = [];
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabase.from('campuses').select('id').eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map(c => c.id);
      }
    }

    if (allowedCampusIds.length === 0) {
      return [];
    }
    query = query.in('campus_id', allowedCampusIds);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Fetches listings scoped strictly to the manager's campus.
 */
export async function getManagerListingsAction() {
  const manager = await getManagerUser();
  if (!manager) return [];

  const { context } = manager;
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select(`
      id,
      slug,
      title,
      price,
      location,
      area,
      county,
      campus_id,
      is_active,
      verified,
      pays_commission,
      commission_locked_by_admin,
      landlord_phone,
      created_at,
      listing_images (
        r2_url,
        display_order
      ),
      agents (
        id,
        name,
        user_id
      ),
      leads (
        id
      ),
      campuses (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (!context.isSuperAdmin) {
    let allowedCampusIds: string[] = [];
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabase.from('campuses').select('id').eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map(c => c.id);
      }
    }

    if (allowedCampusIds.length === 0) {
      return [];
    }
    query = query.in('campus_id', allowedCampusIds);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Fetches all hostels for the manager's campus: official DeKUT housing records
 * plus every agent-uploaded listing (active and inactive) scoped to the campus.
 * Uses the service-role client so managers see the full list; campus scoping is
 * enforced in code via the manager context.
 */
export async function getManagerHostelsAction(): Promise<{
  officialHostels: OfficialHostel[];
  agentListings: AgentListingHostel[];
} | null> {
  const manager = await getManagerUser();
  if (!manager) return null;

  const { context } = manager;

  const [{ data: officialHostels }, { data: listingsRaw }] = await Promise.all([
    (supabaseAdmin as any)
      .from('dekut_official_hostels')
      .select('*')
      .order('hostel_name', { ascending: true }),
    (supabaseAdmin as any)
      .from('listings')
      .select(`
        id, title, location, price, is_active, verified, is_full, created_at, landlord_phone,
        mpesa_details, specific_location, county, area, slug,
        agents ( id, name, phone, whatsapp, verified )
      `)
      .order('created_at', { ascending: false }),
  ]);

  let rawListings = listingsRaw || [];

  if (!context.isSuperAdmin) {
    let allowedCampusIds: string[] = [];
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabaseAdmin
        .from('campuses')
        .select('id')
        .eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map((c: any) => c.id);
      }
    }
    if (allowedCampusIds.length === 0) {
      rawListings = [];
    } else {
      rawListings = rawListings.filter((l: any) =>
        allowedCampusIds.includes(l.campus_id),
      );
    }
  }

  const agentListings = (rawListings as any[]).map(
    (l: any): AgentListingHostel => ({
    id: l.id,
    title: l.title,
    location: l.location || l.area || 'DeKUT',
    price: l.price,
    is_active: l.is_active,
    verified:
      l.verified ||
      (Array.isArray(l.agents) ? l.agents[0]?.verified : l.agents?.verified) ||
      false,
    is_full: l.is_full ?? false,
    created_at: l.created_at,
    landlord_phone: l.landlord_phone || '',
    mpesa_details: l.mpesa_details || '',
    specific_location: l.specific_location || '',
    county: l.county || 'nyeri',
    area: l.area || 'dekut',
    slug: l.slug,
    agent_name: Array.isArray(l.agents)
      ? l.agents[0]?.name || 'Agent'
      : l.agents?.name || 'Agent',
    agent_phone: Array.isArray(l.agents)
      ? l.agents[0]?.phone || ''
      : l.agents?.phone || '',
    agent_whatsapp: Array.isArray(l.agents)
      ? l.agents[0]?.whatsapp || ''
      : l.agents?.whatsapp || '',
  })
);

  return {
    officialHostels: (officialHostels as OfficialHostel[]) || [],
    agentListings,
  };
}

/**
 * Allows a campus manager to suspend or reinstate an agent's account.
 * Scoped strictly to agents where campus_id = managedCampusId.
 *
 * MANDATORY BOUNDARY CHECK:
 * This action ONLY modifies `agents.status` ('active' ↔ 'suspended') and
 * `agents.suspension_reason` when suspending.
 * It CANNOT modify `role`, `campus_id`, `verified`, or any other column.
 */
export async function updateAgentStatusByManagerAction(
  agentId: string,
  status: 'active' | 'suspended',
  suspensionReason?: string
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  if (status !== 'active' && status !== 'suspended') {
    return { success: false, error: 'Invalid status value' };
  }

  if (status === 'suspended' && !suspensionReason?.trim()) {
    return { success: false, error: 'A suspension reason is required.' };
  }

  const { context } = manager;

  // Fetch target agent
  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('id, user_id, campus_id, name, status')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent not found' };
  }

  // Cross-campus Scoping Guard
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(supabaseAdmin, context, agent.campus_id);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot modify agent standing outside your campus',
      };
    }
  }

  const updatePayload: Record<string, unknown> = { status };
  if (status === 'suspended') {
    updatePayload.suspension_reason = suspensionReason!.trim();
  } else {
    updatePayload.suspension_reason = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from('agents')
    .update(updatePayload)
    .eq('id', agentId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/manager/agents');

  // Send notification to agent
  if (agent.user_id) {
    const label = status === 'active' ? 'reinstated' : 'suspended';
    sendPushToUser(agent.user_id, {
      title: `Account Standing Update`,
      body: status === 'active'
        ? 'Your agent account standing has been reinstated by your campus manager.'
        : `Your account has been suspended: ${suspensionReason}`,
      url: '/dashboard',
      tag: `agent-standing-${agentId}`,
    }).catch(() => {});
  }

  return { success: true };
}

// ── Manager Listing Management (Campus-Scoped CRUD) ───────────────────────

interface ManagedListing {
  id: string;
  slug: string | null;
  county: string | null;
  area: string | null;
  campus_id: string;
  agent_id: string | null;
}

/**
 * Verifies the current manager (or admin) is authorized to manage the listing:
 * 1. Loads the listing and its campus_id.
 * 2. Enforces the manager's campus/region scope (super admins pass through).
 *
 * Every manager listing mutation goes through this guard so a manager can never
 * touch listings belonging to another campus.
 */
async function authorizeManagerListingAccess(
  listingId: string,
  context: ManagerUserContext,
): Promise<{ listing: ManagedListing } | { error: string }> {
  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('id, slug, county, area, campus_id, agent_id')
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    return { error: 'Listing not found.' };
  }

  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      listing.campus_id,
    );
    if (!isAuthorized) {
      return {
        error: 'Forbidden: You cannot modify listings outside your campus.',
      };
    }
  }

  return { listing: listing as ManagedListing };
}

function revalidateListingPublicPaths(listing: {
  slug: string | null;
  county: string | null;
  area: string | null;
}) {
  const county = listing.county || 'nyeri';
  const area = listing.area || 'dekut';
  revalidatePath(`/hostels/${county}/${area}`);
  if (listing.slug) {
    revalidatePath(`/hostels/${county}/${area}/${listing.slug}`);
  }
  revalidatePath('/hostels');
  revalidatePath('/');
}

/**
 * Suspends or reinstates an agent-uploaded listing.
 * Scoped strictly to the manager's campus.
 */
export async function updateListingStatusByManagerAction(
  listingId: string,
  isActive: boolean,
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;
  const auth = await authorizeManagerListingAccess(listingId, context);
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await supabaseAdmin
    .from('listings')
    .update({ is_active: isActive })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/listings');
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  revalidateListingPublicPaths(auth.listing);

  // Notify the owning agent when their listing is suspended by the manager.
  if (!isActive && auth.listing.agent_id) {
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('user_id')
      .eq('id', auth.listing.agent_id)
      .single();
    if (agent?.user_id) {
      sendPushToUser(agent.user_id, {
        title: 'Listing Suspended',
        body: 'One of your hostels has been suspended by your campus manager. Contact them for details.',
        url: '/dashboard',
        tag: `listing-suspended-${listingId}`,
      }).catch(() => {});
    }
  }

  return { success: true };
}

/**
 * Updates the landlord/caretaker phone on a listing.
 * Scoped strictly to the manager's campus.
 */
export async function updateListingOwnerPhoneByManagerAction(
  listingId: string,
  ownerPhone: string | null,
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const cleaned = typeof ownerPhone === 'string' ? ownerPhone.trim() : '';
  if (cleaned && !isValidKenyanPhone(cleaned)) {
    return {
      success: false,
      error: 'Please enter a valid Kenyan owner phone number.',
    };
  }

  const { context } = manager;
  const auth = await authorizeManagerListingAccess(listingId, context);
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await supabaseAdmin
    .from('listings')
    .update({ landlord_phone: cleaned || null })
    .eq('id', listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/listings');
  revalidatePath('/dashboard');
  revalidateListingPublicPaths(auth.listing);

  return { success: true };
}

/**
 * Permanently deletes an agent-uploaded listing.
 * Scoped strictly to the manager's campus.
 */
export async function deleteListingByManagerAction(
  listingId: string,
): Promise<ManagerActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { context } = manager;
  const auth = await authorizeManagerListingAccess(listingId, context);
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await supabaseAdmin
    .from('listings')
    .delete()
    .eq('id', listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/manager/listings');
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  revalidateListingPublicPaths(auth.listing);

  return { success: true };
}

function nullableCoord(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Full edit of an agent-uploaded listing by a manager.
 * Reuses the same payload/image/room-type flow as the admin edit action, but
 * enforces manager campus scope and validates the hostel area against the
 * campus's configured zones (the single source of truth).
 */
export async function updateListingByManagerAction(
  formData: any,
): Promise<ManagerActionResult & { listingId?: string; listingUrl?: string }> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  const { context } = manager;
  const auth = await authorizeManagerListingAccess(formData.listing_id, context);
  if ('error' in auth) return { success: false, error: auth.error };
  const existing = auth.listing;

  // Validate the selected hostel area against the campus's configured zones.
  const { data: campusZones } = await supabaseAdmin
    .from('campus_zones')
    .select('id, name')
    .eq('campus_id', existing.campus_id);

  const normalizedArea = normalizeCampusAreaSelection(
    formData.area,
    campusZones || [],
  );
  if (!normalizedArea) {
    return {
      success: false,
      error:
        'Please choose a valid hostel area for this campus. Only the manager-configured areas are allowed.',
    };
  }

  const agentId = formData.agent_id || existing.agent_id;

  const payload = {
    title: formData.title,
    county: formData.county || 'nyeri',
    area: normalizedArea,
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

  try {
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

    revalidatePath('/manager/listings');
    revalidatePath('/manager');
    revalidatePath('/dashboard');
    revalidateListingPublicPaths(listing);

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
