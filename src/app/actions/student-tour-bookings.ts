'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';

type ActionResult = { success: true } | { success: false; error: string };

export async function updateStudentTourBookingAction(
  bookingId: string,
  fields: { preferred_date?: string; preferred_time?: string; phone?: string },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify this booking belongs to the user
  const { data: booking, error: fetchError } = await supabase
    .from('tour_bookings')
    .select('id, status, linked_user_id')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.linked_user_id !== user.id) {
    return { success: false, error: 'Forbidden' };
  }

  // Only allow edits on pending_payment status
  if (booking.status !== 'pending_payment') {
    return { success: false, error: 'Only pending bookings can be edited' };
  }

  // Validate date if provided
  if (fields.preferred_date) {
    const tourDate = new Date(fields.preferred_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (tourDate < today) {
      return { success: false, error: 'Tour date must be in the future' };
    }
  }

  // Validate time if provided
  if (fields.preferred_time) {
    const validTimes = ['morning', 'afternoon', 'evening'];
    if (!validTimes.includes(fields.preferred_time)) {
      return { success: false, error: 'Invalid time window' };
    }
  }

  // Validate phone if provided
  if (fields.phone) {
    const phoneDigits = fields.phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
  }

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (fields.preferred_date) updates.preferred_date = fields.preferred_date;
  if (fields.preferred_time) updates.preferred_time = fields.preferred_time;
  if (fields.phone) updates.phone = fields.phone.trim();

  const { error } = await supabase
    .from('tour_bookings')
    .update(updates)
    .eq('id', bookingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  return { success: true };
}

export async function cancelStudentTourBookingAction(
  bookingId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data: booking, error: fetchError } = await supabase
    .from('tour_bookings')
    .select('id, status, linked_user_id, agent_id')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.linked_user_id !== user.id) {
    return { success: false, error: 'Forbidden' };
  }

  if (booking.status !== 'pending_payment' && booking.status !== 'confirmed') {
    return { success: false, error: 'This booking cannot be cancelled' };
  }

  const { error } = await supabase
    .from('tour_bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify the agent of the cancellation
  if (booking.agent_id) {
    const { data: agentProfile } = await supabase
      .from('agents')
      .select('user_id')
      .eq('id', booking.agent_id)
      .single();

    if (agentProfile?.user_id) {
      sendPushToUser(agentProfile.user_id, {
        title: 'Tour cancelled',
        body: `A student cancelled their tour booking. Check your dashboard.`,
        url: '/dashboard/tours',
        tag: `tour-cancel-${bookingId}`,
      }).catch(() => {});
    }
  }

  revalidatePath('/account');
  return { success: true };
}
