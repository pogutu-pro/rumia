import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TourStatus } from '@/types';

const VALID_STATUS_TRANSITIONS: Record<TourStatus, TourStatus[]> = {
  pending_payment: ['confirmed', 'paid', 'cancelled', 'no_show'],
  confirmed: ['paid', 'cancelled', 'no_show'],
  paid: ['completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, linked_user_id } = body as {
      status?: TourStatus;
      linked_user_id?: string;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current booking
    const { data: booking, error: fetchError } = await (supabase as any)
      .from('tour_bookings')
      .select('*, agents!tour_bookings_agent_id_fkey(user_id)')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check authorization: agent owns booking, or user is admin, or user is linking their own booking
    const isAgent = booking.agents?.user_id === user.id;
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.role === 'admin';
    const isSelfLink = linked_user_id === user.id && !status;

    if (!isAgent && !isAdmin && !isSelfLink) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      // Validate status transition
      const allowed = VALID_STATUS_TRANSITIONS[booking.status as TourStatus];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${booking.status} to ${status}` },
          { status: 400 },
        );
      }
      updatePayload.status = status;
    }

    if (linked_user_id) {
      updatePayload.linked_user_id = linked_user_id;
    }

    const { data: updated, error: updateError } = await (supabase as any)
      .from('tour_bookings')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating tour booking:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Tour booking update error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
