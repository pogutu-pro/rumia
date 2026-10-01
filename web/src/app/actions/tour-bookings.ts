'use server';

import { revalidatePath } from 'next/cache';
import { toursApi } from '@/lib/api/tours';
import type { TourStatus } from '@/types';

type ActionResult = { success: true } | { success: false; error: string };

export async function updateTourBookingStatusAction(
  bookingId: string,
  status: TourStatus,
): Promise<ActionResult> {
  try {
    await toursApi.updateStatusServer(bookingId, status);
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
    await toursApi.deleteServer(bookingId);
    revalidatePath('/dashboard');
    revalidatePath('/admin/tours');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to delete tour booking.' };
  }
}
