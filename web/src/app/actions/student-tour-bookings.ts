'use server';

import { revalidatePath } from 'next/cache';
import { toursApi } from '@/lib/api/tours';

type ActionResult = { success: true } | { success: false; error: string };

export async function updateStudentTourBookingAction(
  bookingId: string,
  fields: { preferred_date?: string; preferred_time?: string; phone?: string },
): Promise<ActionResult> {
  try {
    if (fields.preferred_date) {
      const tourDate = new Date(fields.preferred_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (tourDate < today) {
        return { success: false, error: 'Tour date must be in the future' };
      }
    }

    if (fields.preferred_time) {
      const validTimes = ['morning', 'afternoon', 'evening'];
      if (!validTimes.includes(fields.preferred_time)) {
        return { success: false, error: 'Invalid time window' };
      }
    }

    if (fields.phone) {
      const phoneDigits = fields.phone.replace(/\D/g, '');
      if (phoneDigits.length < 7) {
        return { success: false, error: 'Please enter a valid phone number' };
      }
    }

    await toursApi.updateStatusServer(bookingId, 'pending_payment');
    revalidatePath('/account');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update tour booking.' };
  }
}

export async function cancelStudentTourBookingAction(
  bookingId: string,
): Promise<ActionResult> {
  try {
    await toursApi.updateStatusServer(bookingId, 'cancelled');
    revalidatePath('/account');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to cancel tour booking.' };
  }
}
