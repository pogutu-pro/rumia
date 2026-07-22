import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTourPrice } from '@/lib/constants/tour-pricing';
import type { CreateTourBookingInput, TourType, TourTimeWindow } from '@/types';

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
    } = body as CreateTourBookingInput & { agent_id?: string; linked_user_id?: string };

    // Validate required fields
    if (!student_name || !phone || !zone || !tour_type || !preferred_date || !preferred_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Validate enums
    const validTourTypes: TourType[] = ['specific_hostel', 'full_search'];
    const validTimeWindows: TourTimeWindow[] = ['morning', 'afternoon', 'evening'];

    if (!validTourTypes.includes(tour_type)) {
      return NextResponse.json({ error: 'Invalid tour type' }, { status: 400 });
    }
    if (!validTimeWindows.includes(preferred_time)) {
      return NextResponse.json({ error: 'Invalid time window' }, { status: 400 });
    }

    // Validate phone (basic: at least 7 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 },
      );
    }

    // Compute price server-side (never trust client-sent price)
    const amount = getTourPrice(zone, tour_type);
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
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: booking, error } = await supabase
      .from('tour_bookings')
      .insert({
        student_name: student_name.trim(),
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

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Tour booking error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
