'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/client';
import { listingsApi } from '@/lib/api/listings';
import { managerApi, type ManagedListing } from '@/lib/api/manager';
import {
  listingPayload,
  mapListingImages,
  mapRoomTypes,
} from '@/lib/utils/listing-payload';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';

/**
 * Manager console actions. Campus/region scoping, validation, role changes and notifications
 * are all enforced by FastAPI (`/manager/*`, `/listings/*`, `/zones/*`); these functions call it
 * with the user's session and revalidate caches.
 */

export type ManagerActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface ManagerUserContext {
  userId: string;
  role: 'manager' | 'admin';
  managedCampusId: string | null;
  managedRegionId: string | null;
  isSuperAdmin: boolean;
}

function failure(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof ApiError) {
    return { success: false, error: err.message || fallback };
  }
  return { success: false, error: fallback };
}

/** The signed-in manager/admin and their scope, or null when the user is not one. */
export async function getManagerUser(): Promise<{
  user: { id: string; email?: string };
  context: ManagerUserContext;
} | null> {
  const ctx = await managerApi.context().catch(() => null);
  if (!ctx) return null;

  return {
    user: { id: ctx.user_id, email: ctx.user_email ?? undefined },
    context: {
      userId: ctx.user_id,
      role: ctx.role as 'manager' | 'admin',
      managedCampusId: ctx.managed_campus_id,
      managedRegionId: ctx.managed_region_id,
      isSuperAdmin: ctx.is_super_admin,
    },
  };
}

// The UI reads the embedded campus as `campuses` (legacy PostgREST shape).
const legacyCampus = <T extends { campus?: unknown }>(row: T) => {
  const { campus, ...rest } = row;
  return { ...rest, campuses: campus ?? null };
};

/** Applications for the manager's campuses (all for admins). */
export async function getManagerApplicationsAction() {
  try {
    return (await managerApi.applications()).map(legacyCampus);
  } catch {
    return [];
  }
}

/** Approve: creates the agent, promotes the applicant to 'agent', notifies them. */
export async function approveAgentApplicationAction(
  applicationId: string,
): Promise<ManagerActionResult> {
  try {
    await managerApi.approveApplication(applicationId);
    revalidatePath('/manager/applications');
    revalidatePath('/manager/agents');
    revalidatePath('/account');
    return { success: true };
  } catch (err) {
    return failure(err, 'Unexpected error during approval');
  }
}

/** Reject with a reason; the applicant is notified. */
export async function rejectAgentApplicationAction(
  applicationId: string,
  rejectionReason: string,
): Promise<ManagerActionResult> {
  const reason = rejectionReason?.trim();
  if (!reason) return { success: false, error: 'Rejection reason is required' };
  try {
    await managerApi.rejectApplication(applicationId, reason);
    revalidatePath('/manager/applications');
    revalidatePath('/account');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to reject the application');
  }
}

export async function getManagerAgentsAction() {
  try {
    return (await managerApi.agents()).map(legacyCampus);
  } catch {
    return [];
  }
}

// The listings table reads legacy keys: listing_images, agents, leads[], campuses.
function legacyListing(l: ManagedListing) {
  const { images, agent, lead_count, campus, ...rest } = l;
  return {
    ...rest,
    listing_images: images,
    agents: agent ?? null,
    leads: Array.from({ length: lead_count }, (_, i) => ({ id: `${l.id}-lead-${i}` })),
    campuses: campus ?? null,
  };
}

export async function getManagerListingsAction() {
  try {
    return (await managerApi.listings()).map(legacyListing);
  } catch {
    return [];
  }
}

/** Official DeKUT records plus the listings in the manager's scope. */
export async function getManagerHostelsAction(): Promise<{
  officialHostels: OfficialHostel[];
  agentListings: AgentListingHostel[];
} | null> {
  try {
    const overview = await managerApi.hostels();
    return { officialHostels: overview.official_hostels, agentListings: overview.listings };
  } catch {
    return null;
  }
}

/** Suspend or reinstate an agent (only status + reason change; a reason is required to suspend). */
export async function updateAgentStatusByManagerAction(
  agentId: string,
  status: 'active' | 'suspended',
  suspensionReason?: string,
): Promise<ManagerActionResult> {
  if (status !== 'active' && status !== 'suspended') {
    return { success: false, error: 'Invalid status value' };
  }
  if (status === 'suspended' && !suspensionReason?.trim()) {
    return { success: false, error: 'A suspension reason is required.' };
  }
  try {
    await managerApi.setAgentStanding(agentId, status, suspensionReason?.trim());
    revalidatePath('/manager/agents');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to update the agent');
  }
}

function revalidateManagerListingSurfaces(listing?: {
  slug?: string | null;
  county?: string | null;
  area?: string | null;
}) {
  revalidatePath('/manager/listings');
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  const county = listing?.county || 'nyeri';
  const area = listing?.area || 'dekut';
  revalidatePath(`/hostels/${county}/${area}`);
  if (listing?.slug) revalidatePath(`/hostels/${county}/${area}/${listing.slug}`);
  revalidatePath('/hostels');
  revalidatePath('/');
}

/** Suspend/reinstate a listing; the owning agent is notified on suspension. */
export async function updateListingStatusByManagerAction(
  listingId: string,
  isActive: boolean,
): Promise<ManagerActionResult> {
  try {
    const listing = await listingsApi.toggleActiveServer(listingId, isActive);
    revalidateManagerListingSurfaces(listing);
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to update the listing');
  }
}

export async function updateListingOwnerPhoneByManagerAction(
  listingId: string,
  ownerPhone: string | null,
): Promise<ManagerActionResult> {
  try {
    await managerApi.setOwnerPhone(
      listingId,
      typeof ownerPhone === 'string' && ownerPhone.trim() ? ownerPhone.trim() : null,
    );
    revalidatePath('/manager/listings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to update the owner phone');
  }
}

export async function deleteListingByManagerAction(
  listingId: string,
): Promise<ManagerActionResult> {
  try {
    await listingsApi.deleteServer(listingId);
    revalidateManagerListingSurfaces();
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete the listing');
  }
}

/**
 * Full edit of an agent-uploaded listing by a manager. FastAPI enforces campus scope and that the
 * hostel area is one of the campus's configured zones.
 */
export async function updateListingByManagerAction(
  formData: any,
): Promise<ManagerActionResult & { listingId?: string; listingUrl?: string }> {
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
    revalidateManagerListingSurfaces(listing);

    return {
      success: true,
      listingId: String(listing.id),
      listingUrl: `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`,
    };
  } catch (err) {
    return failure(err, 'An unexpected error occurred');
  }
}
