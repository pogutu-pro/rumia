'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin';
import { adminConsoleApi } from '@/lib/api/admin-console';
import { listingsApi } from '@/lib/api/listings';
import { managerApi } from '@/lib/api/manager';
import {
  listingPayload,
  mapListingImages,
  mapRoomTypes,
} from '@/lib/utils/listing-payload';
import type { CreateAgentInput, CreateCommissionInput } from '@/types';

/**
 * Admin console actions. Every operation is an admin-only FastAPI call (authorization,
 * validation, atomicity and notifications live there); these functions call it and revalidate
 * the affected pages.
 */

type ActionResult = { success: true } | { success: false; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof ApiError) {
    return {
      success: false,
      error: err.status === 401 || err.status === 403 ? 'Unauthorized' : err.message || fallback,
    };
  }
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

async function run(
  fn: () => Promise<unknown>,
  paths: string[],
  fallback: string,
): Promise<ActionResult> {
  try {
    await fn();
    for (const p of paths) revalidatePath(p);
    return { success: true };
  } catch (err) {
    return failure(err, fallback);
  }
}

// ── Agents ─────────────────────────────────────────────────────────────

/** Creates a login identity and its agent record (both or neither). */
export async function createAgentAction(data: CreateAgentInput): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.createAgent(data),
    ['/admin/agents', '/admin/users'],
    'Failed to create agent account',
  );
}

/** Gives an existing user an agent record and the agent role. */
export async function promoteStudentToAgentAction(
  userId: string,
  data: { name: string; phone: string; whatsapp: string },
): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.promoteStudent({ user_id: userId, ...data }),
    ['/admin/users', '/admin/agents'],
    'Failed to promote the user',
  );
}

export async function updateAgentAction(
  agentId: string,
  data: { name?: string; phone?: string; whatsapp?: string },
): Promise<ActionResult> {
  if (data.name === undefined && data.phone === undefined && data.whatsapp === undefined) {
    return { success: false, error: 'No fields to update' };
  }
  return run(
    () => adminConsoleApi.patchAgent(agentId, data),
    ['/admin/agents', `/admin/agents/${agentId}`],
    'Failed to update the agent',
  );
}

/** Suspend (reason required) or reactivate an agent; the agent is notified. */
export async function updateAgentStatusAction(
  agentId: string,
  status: 'active' | 'suspended',
  suspensionReason?: string,
): Promise<ActionResult> {
  if (status === 'suspended' && !suspensionReason?.trim()) {
    return { success: false, error: 'A suspension reason is required.' };
  }
  return run(
    () => adminConsoleApi.setAgentStanding(agentId, status, suspensionReason?.trim()),
    ['/admin/agents', `/admin/agents/${agentId}`],
    'Failed to update the agent status',
  );
}

/** Featured agents are listed first and get the "Official Rumia Agent" treatment. */
export async function toggleAgentFeaturedAction(agentId: string, featured: boolean): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setAgentFlags(agentId, { is_featured: featured }),
    ['/admin/agents', '/agents'],
    'Failed to update the agent',
  );
}

/** Founder badge: independent of "Official". */
export async function toggleAgentFounderAction(agentId: string, founder: boolean): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setAgentFlags(agentId, { is_founder: founder }),
    ['/admin/agents', '/agents'],
    'Failed to update the agent',
  );
}

export async function toggleAgentVerifiedAction(agentId: string, verified: boolean): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setAgentFlags(agentId, { verified }),
    ['/admin/agents', '/agents'],
    'Failed to update the agent',
  );
}

/** Customer-support team placement; making someone the owner clears the previous owner. */
export async function updateAgentSupportAction(
  agentId: string,
  fields: { is_support?: boolean; support_rank?: number; is_owner?: boolean },
): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setAgentSupport(agentId, fields),
    ['/admin/agents', '/admin/support', '/verify'],
    'Failed to update the support team',
  );
}

/** Checks an agent's numbers against the official records without changing the agent. */
export async function verifyAgentAction(agentId: string): Promise<
  ActionResult & {
    result?: { verified: boolean; matchedHostels: string[]; sharedContactDetected: boolean };
  }
> {
  try {
    const r = await adminConsoleApi.agentVerification(agentId);
    return {
      success: true,
      result: {
        verified: r.verified,
        matchedHostels: r.matched_hostels,
        sharedContactDetected: r.shared_contact_detected,
      },
    };
  } catch (err) {
    return failure(err, 'Verification failed');
  }
}

// ── Users ──────────────────────────────────────────────────────────────

export async function updateUserRoleAction(
  userId: string,
  newRole: 'student' | 'agent',
): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.changeRole(userId, newRole),
    ['/admin/agents', '/admin/users', '/admin/managers'],
    'Failed to update the role',
  );
}

/** Promotes a user to admin (root access); manager scope is cleared. */
export async function promoteToAdminAction(userId: string): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.promoteToAdmin(userId),
    ['/admin/agents', '/admin/users', '/admin/managers'],
    'Failed to promote the user',
  );
}

// ── Listings ───────────────────────────────────────────────────────────

const LISTING_PATHS = ['/admin/listings', '/admin', '/hostels', '/'];

export async function updateListingActiveAction(listingId: string, isActive: boolean): Promise<ActionResult> {
  return run(() => listingsApi.toggleActiveServer(listingId, isActive), LISTING_PATHS, 'Failed to update the listing');
}

/** When locked, the agent cannot change the listing's commission setting. */
export async function toggleCommissionLockAction(listingId: string, locked: boolean): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setCommissionLock(listingId, locked),
    ['/admin/listings', '/admin'],
    'Failed to update the commission lock',
  );
}

/** Admin override of pays_commission, regardless of the agent's setting or lock. */
export async function setListingCommissionAction(listingId: string, paysCommission: boolean): Promise<ActionResult> {
  return run(
    () => listingsApi.toggleCommissionServer(listingId, paysCommission),
    ['/admin/listings', '/dashboard', '/admin'],
    'Failed to update the commission setting',
  );
}

/** Empty values clear the owner phone (runtime falls back to the agent). */
export async function updateListingOwnerPhoneAction(
  listingId: string,
  ownerPhone: string | null,
): Promise<ActionResult> {
  return run(
    () =>
      managerApi.setOwnerPhone(
        listingId,
        typeof ownerPhone === 'string' && ownerPhone.trim() ? ownerPhone.trim() : null,
      ),
    ['/admin/listings', '/dashboard', '/hostels'],
    'Failed to update the owner phone',
  );
}

export async function deleteListingAction(listingId: string): Promise<ActionResult> {
  return run(() => listingsApi.deleteServer(listingId), ['/admin/listings', '/hostels', '/'], 'Failed to delete the listing');
}

/** Saves a custom order (atomic, with an audit trail); a null position clears it. */
export async function updateListingsOrderAction(
  updates: Array<{ id: string; sort_position: number | null }>,
): Promise<ActionResult> {
  if (updates.length === 0) return { success: true };
  return run(() => adminConsoleApi.reorder(updates), LISTING_PATHS, 'Failed to save the order');
}

/** Gives every listing a fresh random position. */
export async function shuffleListingsOrderAction(): Promise<ActionResult> {
  return run(() => adminConsoleApi.shuffle(), LISTING_PATHS, 'Failed to shuffle listings');
}

export async function transferListingAction(listingId: string, newOwnerId: string): Promise<ActionResult> {
  return run(
    () => adminApi.transferListingServer(listingId, newOwnerId),
    ['/admin/listings', '/admin', '/admin/transfers'],
    'Failed to transfer listing',
  );
}

/** Admin edit of ANY listing (images and room types are replaced). */
export async function adminUpdateListingAction(
  formData: any,
): Promise<ActionResult & { listingId?: string; listingUrl?: string }> {
  if (!formData.listing_id) return { success: false, error: 'Missing listing id.' };
  try {
    const payload: any = {
      ...listingPayload(formData),
      is_active: formData.is_active,
      agent_whatsapp: null,
      images: mapListingImages(formData.images),
      room_types: mapRoomTypes(formData.roomTypes),
    };
    const listing = await listingsApi.updateServer(formData.listing_id, payload);
    for (const p of LISTING_PATHS) revalidatePath(p);
    const url = `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`;
    revalidatePath(url);
    return { success: true, listingId: String(listing.id), listingUrl: url };
  } catch (err) {
    return failure(err, 'An unexpected error occurred');
  }
}

// ── Verification against the official DeKUT records ─────────────────────

/** Checks one listing; only fills verification fields that are not already set. */
export async function verifyListingAction(listingId: string): Promise<
  ActionResult & {
    result?: { verified: boolean; match_type: string; matched_hostel: string | null; flags: string[] };
  }
> {
  try {
    const result = await adminConsoleApi.verifyListing(listingId);
    revalidatePath('/admin');
    return { success: true, result };
  } catch (err) {
    return failure(err, 'Verification failed');
  }
}

/** Re-runs verification for every active listing. */
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
  try {
    const summary = await adminConsoleApi.verifyAll();
    revalidatePath('/admin');
    return { success: true, summary };
  } catch (err) {
    return failure(err, 'Bulk verification failed');
  }
}

export async function toggleListingVerifiedAction(listingId: string, verified: boolean): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.setListingVerified(listingId, verified),
    ['/admin', '/admin/listings', '/hostels'],
    'Failed to toggle listing verification',
  );
}

// ── Official records ───────────────────────────────────────────────────

type OfficialHostelPayload = {
  hostel_name: string;
  zone: string;
  contacts: string;
  payments: string;
  source?: string;
};

export async function getOfficialHostelsAction(): Promise<ActionResult & { data?: any[] }> {
  try {
    const { officialHostelsApi } = await import('@/lib/api/official-hostels');
    return { success: true, data: await officialHostelsApi.listServer() };
  } catch (err) {
    return failure(err, 'Failed to fetch official hostels');
  }
}

export async function createOfficialHostelAction(payload: OfficialHostelPayload): Promise<ActionResult> {
  if (!payload.hostel_name?.trim() || !payload.zone?.trim()) {
    return { success: false, error: 'Hostel name and zone are required.' };
  }
  return run(
    () => adminConsoleApi.createOfficialHostel(payload),
    ['/admin', '/admin/official-hostels'],
    'Failed to create official hostel',
  );
}

export async function updateOfficialHostelAction(id: string, payload: OfficialHostelPayload): Promise<ActionResult> {
  if (!id || !payload.hostel_name?.trim() || !payload.zone?.trim()) {
    return { success: false, error: 'Missing required fields.' };
  }
  return run(
    () => adminConsoleApi.updateOfficialHostel(id, payload),
    ['/admin', '/admin/official-hostels'],
    'Failed to update official hostel',
  );
}

export async function deleteOfficialHostelAction(id: string): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.deleteOfficialHostel(id),
    ['/admin', '/admin/official-hostels'],
    'Failed to delete official hostel',
  );
}

/** Loads the bundled official records (idempotent: names already present are skipped). */
export async function seedOfficialHostelsAction(): Promise<ActionResult & { seededCount?: number }> {
  try {
    const { seeded } = await adminConsoleApi.seedOfficialHostels();
    revalidatePath('/admin');
    revalidatePath('/admin/official-hostels');
    return { success: true, seededCount: seeded };
  } catch (err) {
    return failure(err, 'Failed to seed official hostels');
  }
}

// ── Commissions ────────────────────────────────────────────────────────

export async function createCommissionAction(data: CreateCommissionInput): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.createCommission(data),
    ['/admin/commissions', '/admin/leads'],
    'Failed to create the commission',
  );
}

export async function markCommissionPaidAction(commissionId: string): Promise<ActionResult> {
  return run(
    () => adminConsoleApi.payCommission(commissionId),
    ['/admin/commissions', '/admin/agents'],
    'Failed to mark the commission as paid',
  );
}
