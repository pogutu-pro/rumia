'use server';

import { revalidatePath } from 'next/cache';
import { listingsApi } from '@/lib/api/listings';
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

function revalidateListingSurfaces(
  county = 'nyeri',
  area = 'dekut',
  slug?: string | null,
) {
  revalidatePath('/hostels');
  revalidatePath('/dashboard');
  revalidatePath('/admin/listings');
  revalidatePath(`/hostels/${county}/${area}`);

  if (slug) {
    revalidatePath(`/hostels/${county}/${area}/${slug}`);
  }
}

export async function createListingAction(formData: any) {
  try {
    const images = mapListingImages(formData.images);
    const room_types = mapRoomTypes(formData.roomTypes);

    const payload = {
      ...listingPayload(formData, formData.agent_id),
      county: formData.county || 'nyeri',
      area: formData.area || 'dekut',
      images,
      room_types,
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    const listing = await listingsApi.createServer(payload);

    const county = listing.county || formData.county || 'nyeri';
    const area = listing.area || formData.area || 'dekut';

    revalidateListingSurfaces(county, area, listing.slug);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${county}/${area}/${listing.slug}`,
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
      county: formData.county || 'nyeri',
      area: formData.area || 'dekut',
      agent_whatsapp: formData.agent_whatsapp || null,
    };

    if (formData.images) payload.images = mapListingImages(formData.images);
    if (formData.roomTypes) payload.room_types = mapRoomTypes(formData.roomTypes);

    const listing = await listingsApi.updateServer(formData.listing_id, payload);

    const county = listing.county || formData.county || 'nyeri';
    const area = listing.area || formData.area || 'dekut';

    revalidateListingSurfaces(county, area, listing.slug);

    return {
      success: true,
      listingId: listing.id,
      listingUrl: `/hostels/${county}/${area}/${listing.slug}`,
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
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

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
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

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
    const county = updated.county || 'nyeri';
    const area = updated.area || 'dekut';
    revalidatePath(`/hostels/${county}/${area}`);
    if (updated.slug) {
      revalidatePath(`/hostels/${county}/${area}/${updated.slug}`);
      revalidatePath(`/listing/${updated.id}`);
    }

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
