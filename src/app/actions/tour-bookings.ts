'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';
import type { TourStatus } from '@/types';

type ActionResult = { success: true } | { success: false; error: string };

const VALID_STATUS_TRANSITIONS: Record<TourStatus, TourStatus[]> = {
  pending_payment: ['confirmed', 'paid', 'cancelled', 'no_show'],
  confirmed: ['paid', 'cancelled', 'no_show'],
  paid: ['completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export async function updateTourBookingStatusAction(
  bookingId: string,
  status: TourStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify the user owns the agent for this booking, or is admin
  const { data: booking, error: fetchError } = await (supabase as any)
    .from('tour_bookings')
    .select('id, agent_id, status, linked_user_id, student_name, agents!tour_bookings_agent_id_fkey(user_id)')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  const isAgent = booking.agents?.user_id === user.id;
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isAdmin = profile?.role === 'admin';

  if (!isAgent && !isAdmin) {
    return { success: false, error: 'Forbidden' };
  }

  // Validate status transition
  const allowed = VALID_STATUS_TRANSITIONS[booking.status as TourStatus];
  if (allowed && !allowed.includes(status)) {
    return {
      success: false,
      error: `Cannot transition from "${booking.status.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}"`,
    };
  }

  const { error } = await (supabase as any)
    .from('tour_bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify the student of the status change
  if (booking.linked_user_id) {
    const statusLabels: Record<string, string> = {
      confirmed: 'confirmed',
      paid: 'payment received',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'marked as no-show',
    };
    const label = statusLabels[status] || status.replace(/_/g, ' ');
    sendPushToUser(booking.linked_user_id, {
      title: 'Tour update',
      body: `Your tour booking has been ${label}${booking.student_name ? ` (${booking.student_name})` : ''}`,
      url: '/account?tab=tours',
      tag: `tour-update-${bookingId}`,
    }).catch(() => {});
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin/tours');

  return { success: true };
}
