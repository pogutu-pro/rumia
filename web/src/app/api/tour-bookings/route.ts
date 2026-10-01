import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/client';
import { toursApi, type TourBookingCreate } from '@/lib/api/tours';
import { toursServerApi } from '@/lib/api/tours.server';

/**
 * Thin same-origin proxy to FastAPI `POST /tours`. The session cookie is forwarded as a bearer
 * token, so a signed-in student is linked by the server (never by a client-sent user id), and
 * the amount is computed from the zone price server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TourBookingCreate>;

    if (
      !body.student_name ||
      !body.phone ||
      !body.zone ||
      !body.tour_type ||
      !body.preferred_date ||
      !body.preferred_time
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const booking = await toursServerApi.createServer({
      student_name: body.student_name,
      phone: body.phone,
      listing_id: body.listing_id ?? null,
      zone: body.zone,
      campus_id: body.campus_id ?? null,
      tour_type: body.tour_type,
      preferred_date: body.preferred_date,
      preferred_time: body.preferred_time,
      agent_id: body.agent_id ?? null,
      from_listing: !!body.from_listing,
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      const message =
        error.data?.detail?.message ??
        (error.status === 429 ? 'Too many requests. Please try again shortly.' : error.message);
      return NextResponse.json({ error: message }, { status: error.status });
    }
    console.error('Tour booking error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
