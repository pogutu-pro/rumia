'use server';

import { revalidatePath } from 'next/cache';
import { bnbApi, type BnbListingPayload, type BnbListingUpdatePayload } from '@/lib/api/bnb';

function revalidateBnbSurfaces() {
  revalidatePath('/');
  revalidatePath('/dashboard/bnb');
  revalidatePath('/hostels');
}

export async function createBnbListingAction(
  payload: BnbListingPayload,
): Promise<{ success: boolean; listingId?: string; error?: string }> {
  try {
    const listing = await bnbApi.createServer(payload);
    revalidateBnbSurfaces();
    return { success: true, listingId: listing.id };
  } catch (error: any) {
    console.error('createBnbListingAction error:', error);
    return { success: false, error: error.message || 'Failed to create BnB listing.' };
  }
}

export async function updateBnbListingAction(
  listingId: string,
  payload: BnbListingUpdatePayload,
): Promise<{ success: boolean; listingId?: string; error?: string }> {
  try {
    const listing = await bnbApi.updateServer(listingId, payload);
    revalidateBnbSurfaces();
    if (listing.slug) {
      revalidatePath(`/listing/${listing.id}`);
    }
    return { success: true, listingId: listing.id };
  } catch (error: any) {
    console.error('updateBnbListingAction error:', error);
    return { success: false, error: error.message || 'Failed to update BnB listing.' };
  }
}

export async function toggleBnbActiveAction(
  listingId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Reuse the existing listings toggle-active endpoint
    const { listingsApi } = await import('@/lib/api/listings');
    await listingsApi.toggleActiveServer(listingId, isActive);
    revalidateBnbSurfaces();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to toggle status.' };
  }
}

export async function deleteBnbListingAction(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { listingsApi } = await import('@/lib/api/listings');
    await listingsApi.deleteServer(listingId);
    revalidateBnbSurfaces();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete BnB listing.' };
  }
}
