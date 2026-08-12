import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import {
  cleanPhone,
  buildWhatsAppUrl,
  hostelOwnerMessage,
  agentHostelInquiryMessage,
  agentInquiryMessage,
} from '@/lib/utils/phone';
import { getPostHogClient } from '@/lib/posthog-server';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listing_id, agent_id, contact_type, name, phone: userPhone } = body;
    const resolvedContactType = contact_type || 'rumia_agent';

    if (!listing_id || !agent_id) {
      return NextResponse.json(
        { error: 'Missing listing_id or agent_id' },
        { status: 400 },
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimitKey = `track-lead:${ip}:${listing_id}`;
    if (!checkRateLimit(rateLimitKey, 1, 10_000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const supabase = await createClient();

    // Simple SHA-256 hash of IP using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Check if this IP clicked this listing in the last 24 hours to prevent spam
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('ip_hash', ipHash)
      .gt('clicked_at', oneDayAgo)
      .limit(1);

    const isDuplicate = existingLeads && existingLeads.length > 0;

    // Fetch listing details to calculate commission and enforce contact rules
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('price, title, pays_commission, landlord_phone, room_type, area, slug, county, youtube_id, campus_id, campuses ( consultation_fee )')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Fetch agent to get WhatsApp, commission balance, and Pochi details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('name, whatsapp, phone, commission_balance, pochi_la_biashara_number, expected_name')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const consultationFee = listing.campuses?.[0]?.consultation_fee != null
      ? Number(listing.campuses[0].consultation_fee)
      : null;

    const paysCommission = listing.pays_commission === true;
    const feeAccepted = body.fee_accepted === true;

    if (
      resolvedContactType === 'rumia_agent' &&
      !paysCommission &&
      !feeAccepted
    ) {
      return NextResponse.json(
        {
          error: 'Fee disclosure required before contacting a Rumia Agent.',
          requiresFee: true,
        },
        { status: 409 },
      );
    }

    // Record the lead if not a duplicate
    if (!isDuplicate) {
      const { error: leadError } = await supabase.from('leads').insert({
        listing_id,
        agent_id,
        clicked_at: new Date().toISOString(),
        ip_hash: ipHash,
        contact_type: resolvedContactType,
        name: name || null,
        phone: userPhone || null,
      });

      if (leadError) {
        console.error('Error recording lead:', leadError);
      }

      // Notify the agent of the new inquiry
      const { data: agentProfile } = await supabase
        .from('agents')
        .select('user_id')
        .eq('id', agent_id)
        .single();

      if (agentProfile?.user_id) {
        sendPushToUser(agentProfile.user_id, {
          title: 'New student inquiry',
          body: `Someone is interested in "${listing.title}". Check your dashboard.`,
          url: '/dashboard',
          tag: 'new-inquiry',
        }).catch(() => {});
      }

      if (paysCommission) {
        // Calculate commission (10% of monthly listing price or flat rate of KSh 1,000)
        const commissionAmount = Math.max(
          1000,
          Math.round(listing.price * 0.1),
        );

        // Insert commission
        const { error: commError } = await supabase.from('commissions').insert({
          agent_id,
          listing_id,
          amount: commissionAmount,
          status: 'pending',
        });

        if (commError) {
          console.error('Error inserting commission:', commError);
        } else {
          // Increment agent commission balance
          const newBalance = (agent.commission_balance || 0) + commissionAmount;
          const { error: agentUpdateError } = await supabase
            .from('agents')
            .update({ commission_balance: newBalance })
            .eq('id', agent_id);

          if (agentUpdateError) {
            console.error('Error updating agent balance:', agentUpdateError);
          }
        }
      }

      const distinctId = request.headers.get('x-posthog-distinct-id') ?? ipHash;
      const ph = getPostHogClient();
      if (ph) {
        ph.capture({
          distinctId,
          event: 'lead_created',
          properties: {
            listing_id,
            agent_id,
            contact_type: resolvedContactType,
            pays_commission: paysCommission,
            fee_accepted: feeAccepted,
          },
        });
        await ph.flush();
      }
    }

    // Determine WhatsApp number and build contextual message
    const formattedPhone = agent.whatsapp || agent.phone || '';
    const waPhone = cleanPhone(formattedPhone);

    let message: string;
    if (resolvedContactType === 'hostel_owner') {
      // hostel_owner: use landlord_phone if available, else agent phone
      const ownerPhone = listing.landlord_phone
        ? cleanPhone(listing.landlord_phone)
        : waPhone;
      message = hostelOwnerMessage({
        title: listing.title,
        roomType: listing.room_type,
        price: listing.price,
        zone: listing.area,
        slug: listing.slug,
        county: listing.county,
        hasVideo: !!listing.youtube_id,
      });
     const whatsappUrl = buildWhatsAppUrl(ownerPhone, message);
      return NextResponse.json({ success: true, whatsappUrl });
    } else if (resolvedContactType === 'rumia_agent') {
      message = agentHostelInquiryMessage({
        listingTitle: listing.title,
        agentName: agent.name || 'your agent',
        whatsapp: agent.whatsapp || agent.phone || '',
        pochiLaBiasharaNumber: agent.pochi_la_biashara_number,
        expectedName: agent.expected_name,
        consultationFee: consultationFee ?? undefined,
      });
    } else {
      // Legacy fallback: original message
      message = `Hello, I'm interested in your listing: "${listing.title}" on Rumia. Is it still available?`;
    }

    const whatsappUrl = buildWhatsAppUrl(waPhone, message);
    return NextResponse.json({ success: true, whatsappUrl });
  } catch (error) {
    console.error('Lead tracking error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
