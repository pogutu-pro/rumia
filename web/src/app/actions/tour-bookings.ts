'use server';

import { revalidatePath } from 'next/cache';
import type { TourStatus } from '@/types';
import { toursServerApi } from '@/lib/api/tours.server';

type ActionResult = { success: true } | { success: false; error: string };

export async function updateTourBookingStatusAction(
  bookingId: string,
  status: TourStatus,
): Promise<ActionResult> {
  try {
    await toursServerApi.updateStatusServer(bookingId, status);
    revalidatePath('/dashboard');
    revalidatePath('/admin/tours');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update tour booking status.' };
  }
}

export async function deleteTourBookingAction(
  bookingId: string,
): Promise<ActionResult> {
  try {
    await toursServerApi.deleteServer(bookingId);
    revalidatePath('/dashboard');
    revalidatePath('/admin/tours');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to delete tour booking.' };
  }
}
