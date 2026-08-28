import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getZoneTourPrice } from '@/lib/utils/zone-tour-price';
import { sendPushToUser } from '@/lib/push';
import type { CreateTourBookingInput, TourType, TourTimeWindow } from '@/types';
import { getPostHogClient } from '@/lib/posthog-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_name,
      phone,
      listing_id,
      zone,
      tour_type,
      preferred_date,
      preferred_time,
      agent_id,
      linked_user_id,
      from_listing,
      campus_id,
    } = body as CreateTourBookingInput & {
      agent_id?: string;
      linked_user_id?: string;
      from_listing?: boolean;
      selected_listing_ids?: string[];
      campus_id?: string;
    };

    // Validate required fields
    if (
      !student_name ||
      !phone ||
      !zone ||
      !tour_type ||
      !preferred_date ||
      !preferred_time
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Validate enums
    const validTourTypes: TourType[] = ['specific_hostel', 'full_search'];
    const validTimeWindows: TourTimeWindow[] = [
      'morning',
      'afternoon',
      'evening',
    ];

    if (!validTourTypes.includes(tour_type)) {
      return NextResponse.json({ error: 'Invalid tour type' }, { status: 400 });
    }
    if (!validTimeWindows.includes(preferred_time)) {
      return NextResponse.json(
        { error: 'Invalid time window' },
        { status: 400 },
      );
    }

    // Validate phone (basic: at least 7 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 },
      );
    }

    // Compute price server-side (never trust client-sent price).
    // Tours are per zone — the amount is the zone's configured tour price
    // (campus_zones.full_search_price) on an active campus, regardless of
    // hostel count.
    const amount = await getZoneTourPrice(zone, campus_id);
    if (amount === null) {
      return NextResponse.json(
        { error: `No pricing configured for zone: ${zone}` },
        { status: 400 },
      );
    }

    // Validate date is in the future
    const tourDate = new Date(preferred_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (tourDate < today) {
      return NextResponse.json(
        { error: 'Tour date must be in the future' },
        { status: 400 },
      );
    }

    // Resolve agent_id from listing if not provided
    let resolvedAgentId = agent_id || null;
    if (!resolvedAgentId && listing_id) {
      const supabaseForLookup = await createClient();
      const { data: listing } = await supabaseForLookup
        .from('listings')
        .select('agent_id')
        .eq('id', listing_id)
        .single();
      resolvedAgentId = listing?.agent_id || null;
    }

    // Fallback: assign first available agent for standalone full-search bookings
    if (!resolvedAgentId) {
      const supabaseForLookup = await createClient();
      const { data: fallbackAgent } = await supabaseForLookup
        .from('agents')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      resolvedAgentId = fallbackAgent?.id || null;
    }

    // Use service-role client for insert (bypasses RLS for anon inserts)
    const { createClient: createServiceClient } =
      await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: booking, error } = await supabase
      .from('tour_bookings')
      .insert({
        student_name: studentNameTrimmed(student_name),
        phone: phone.trim(),
        listing_id: listing_id || null,
        zone,
        tour_type,
        amount,
        preferred_date,
        preferred_time,
        status: 'pending_payment',
        agent_id: resolvedAgentId,
        linked_user_id: linked_user_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tour booking:', error);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 },
      );
    }

    // Notify the assigned agent
    if (resolvedAgentId) {
      const { data: agentProfile } = await supabase
        .from('agents')
        .select('user_id')
        .eq('id', resolvedAgentId)
        .single();

      if (agentProfile?.user_id) {
        const timeLabel =
          preferred_time === 'morning'
            ? 'morning'
            : preferred_time === 'afternoon'
              ? 'afternoon'
              : 'evening';

        sendPushToUser(agentProfile.user_id, {
          title: 'New tour booking',
          body: `${studentNameTrimmed(student_name)} booked a tour in ${zone} for ${timeLabel} on ${preferred_date}`,
          url: '/dashboard/tours',
          tag: 'new-tour-booking',
        }).catch(() => {});
      }
    }

    // Confirm to the student
    if (linked_user_id) {
      sendPushToUser(linked_user_id, {
        title: 'Tour booking received',
        body: `Your tour in ${zone} is booked for ${preferred_date}. An agent will confirm shortly.`,
        url: '/account?tab=tours',
        tag: `tour-confirm-${booking.id}`,
      }).catch(() => {});
    }

    // Notify all admins of the new booking
    import('@/lib/push').then(({ sendPushToUsers, getAdminUserIds }) =>
      getAdminUserIds().then((adminIds) => {
        if (adminIds.length > 0) {
          sendPushToUsers(adminIds, {
            title: 'New tour booking',
            body: `${studentNameTrimmed(student_name)} booked a tour in ${zone}.`,
            url: '/admin/tours',
            tag: 'new-tour-admin',
          }).catch(() => {});
        }
      }),
    );

    const distinctId = linked_user_id ?? booking.id;
    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId,
        event: 'tour_booking_created',
        properties: {
          booking_id: booking.id,
          tour_type,
          zone,
          preferred_time,
          amount,
          from_listing: !!from_listing,
          listing_id: listing_id ?? null,
        },
      });
      await ph.flush();
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Tour booking error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

function studentNameTrimmed(name: string): string {
  return name.trim();
}
