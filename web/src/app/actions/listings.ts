'use server';

import { revalidatePath } from 'next/cache';
import { listingsApi } from '@/lib/api/listings';
import { listingPath } from '@/lib/utils/listing-path';
import {
  listingPayload,
  mapListingImages,
  mapRoomTypes,
} from '@/lib/utils/listing-payload';
import type {
  OfficialHostel,
  AgentListingHostel,
} from '@/app/(admin)/admin/official-hostels/official-hostels-table-client';
import { officialHostelsApi } from '@/lib/api/official-hostels';

/** Refresh every page that shows a listing. The listing's own address decides its paths; nothing is assumed. */
function revalidateListingSurfaces(listing: { county?: string | null; area?: string | null; slug?: string | null; property_type?: string | null }) {
  revalidatePath('/hostels');
  revalidatePath('/dashboard');
  revalidatePath('/admin/listings');
  if (listing.slug) {
    const path = listingPath(listing);
    revalidatePath(path);
    // The place page above the listing: /{market}/{type}/{place}
    revalidatePath(path.split('/').slice(0, -1).join('/'));
  }
}

export async function createListingAction(formData: any) {
  try {
    if (!formData.county) return { success: false, error: 'Choose where this place is before saving it.' };
    const images = mapListingImages(formData.images);
    const room_types = mapRoomTypes(formData.roomTypes);

    const payload = {
      ...listingPayload(formData, formData.agent_id),
      images,
      room_types,
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    const listing = await listingsApi.createServer(payload);

    revalidateListingSurfaces(listing);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: listingPath(listing),
    };
  } catch (error: any) {
    console.error('createListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to create listing.',
    };
  }
}

export async function updateListingAction(formData: any) {
  if (!formData.listing_id) {
    return { success: false, error: 'Missing listing id.' };
  }

  try {
    const payload: any = {
      ...listingPayload(formData, formData.agent_id),
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    if (formData.images) payload.images = mapListingImages(formData.images);
    if (formData.roomTypes) payload.room_types = mapRoomTypes(formData.roomTypes);

    const listing = await listingsApi.updateServer(formData.listing_id, payload);

    revalidateListingSurfaces(listing);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: listingPath(listing),
    };
  } catch (error: any) {
    console.error('updateListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to update listing.',
    };
  }
}

export async function toggleListingActiveAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isActive?: boolean }> {
  try {
    const current = await listingsApi.getByIdAuthenticatedServer(listingId);
    const updated = await listingsApi.toggleActiveServer(listingId, !current.is_active);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    revalidateListingSurfaces(updated);
    if (updated.slug) revalidatePath(`/listing/${updated.id}`);

    return { success: true, isActive: updated.is_active ?? true };
  } catch (error: any) {
    console.error('toggleListingActiveAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle active status.',
    };
  }
}

export async function toggleListingFullAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; isFull?: boolean }> {
  try {
    const current = await listingsApi.getByIdAuthenticatedServer(listingId);
    const updated = await listingsApi.toggleFullServer(listingId, !current.is_full);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    revalidateListingSurfaces(updated);
    if (updated.slug) revalidatePath(`/listing/${updated.id}`);

    return { success: true, isFull: updated.is_full ?? false };
  } catch (error: any) {
    console.error('toggleListingFullAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle full status.',
    };
  }
}

export async function toggleListingCommissionAction(
  listingId: string,
): Promise<{ success: boolean; error?: string; paysCommission?: boolean }> {
  try {
    const current = await listingsApi.getByIdAuthenticatedServer(listingId);
    const updated = await listingsApi.toggleCommissionServer(listingId, !current.pays_commission);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    revalidateListingSurfaces(updated);
    if (updated.slug) revalidatePath(`/listing/${updated.id}`);

    return { success: true, paysCommission: updated.pays_commission ?? false };
  } catch (error: any) {
    console.error('toggleListingCommissionAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to toggle commission status.',
    };
  }
}

export async function deleteListingAction(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await listingsApi.deleteServer(listingId);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/listings');
    revalidatePath('/hostels');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('deleteListingAction error:', error);
    return {
      success: false,
      error: error.message || error.data?.detail || 'Failed to delete listing.',
    };
  }
}

export async function getAgentHostelsAction(): Promise<{
  officialHostels: OfficialHostel[];
  agentListings: AgentListingHostel[];
} | null> {
  try {
    const overview = await officialHostelsApi.overviewServer();
    return {
      officialHostels: overview.official_hostels,
      agentListings: overview.listings,
    };
  } catch {
    // Signed out, or not an agent/manager/admin.
    return null;
  }
}
