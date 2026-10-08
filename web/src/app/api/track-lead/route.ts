import { clientIpFrom } from '@/lib/net/client-ip';
import { NextRequest, NextResponse } from 'next/server';
import {
  cleanPhone,
  buildWhatsAppUrl,
  hostelOwnerMessage,
  agentHostelInquiryMessage,
} from '@/lib/utils/phone';
import { checkRateLimit } from '@/lib/rate-limiter';
import { leadsApi, LeadTrackError, type LeadContactType } from '@/lib/api/leads';

/**
 * Thin same-origin proxy: records the lead through FastAPI (all rules, deduping and
 * commission accounting live there) and turns the returned contact details into the
 * WhatsApp deep link, which depends on UI message templates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listing_id, contact_type, name, phone: userPhone } = body;
    const contactType: LeadContactType =
      contact_type === 'hostel_owner' ? 'hostel_owner' : 'rumia_agent';

    if (!listing_id || !body.agent_id) {
      return NextResponse.json({ error: 'Missing listing_id or agent_id' }, { status: 400 });
    }

    const ip = clientIpFrom(request.headers) || '127.0.0.1';

    if (!checkRateLimit(`track-lead:${ip}:${listing_id}`, 1, 10_000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const tracked = await leadsApi.trackServer(
      {
        listing_id,
        contact_type: contactType,
        name: name || null,
        phone: userPhone || null,
        fee_accepted: body.fee_accepted === true,
      },
      ip,
    );

    const { agent, listing } = tracked;
    const agentPhone = cleanPhone(agent.whatsapp || agent.phone || '');

    if (contactType === 'hostel_owner') {
      // Owner number if known, otherwise fall back to the agent.
      const ownerPhone = listing.landlord_phone ? cleanPhone(listing.landlord_phone) : agentPhone;
      const message = hostelOwnerMessage({
        title: listing.title,
        roomType: listing.room_type ?? undefined,
        price: listing.price,
        zone: listing.area ?? undefined,
        slug: listing.slug ?? undefined,
        county: listing.county ?? undefined,
        hasVideo: listing.has_video,
      });
      return NextResponse.json({ success: true, whatsappUrl: buildWhatsAppUrl(ownerPhone, message) });
    }

    const message = agentHostelInquiryMessage({
      listingTitle: listing.title,
      agentName: agent.name || 'your agent',
      whatsapp: agent.whatsapp || agent.phone || '',
      pochiLaBiasharaNumber: agent.pochi_la_biashara_number ?? undefined,
      expectedName: agent.expected_name ?? undefined,
      consultationFee: tracked.consultation_fee ?? undefined,
      isFull: listing.is_full,
    });
    return NextResponse.json({ success: true, whatsappUrl: buildWhatsAppUrl(agentPhone, message) });
  } catch (error) {
    if (error instanceof LeadTrackError) {
      if (error.status === 409 && error.code === 'FEE_REQUIRED') {
        return NextResponse.json({ error: error.message, requiresFee: true }, { status: 409 });
      }
      if (error.status === 409 && error.code === 'REQUIRES_AGENT') {
        return NextResponse.json({ error: error.message, requiresAgent: true }, { status: 409 });
      }
      if (error.status === 404) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
      }
    }
    console.error('Lead tracking error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
