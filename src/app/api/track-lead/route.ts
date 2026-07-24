import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { cleanPhone, buildWhatsAppUrl, hostelOwnerMessage, agentInquiryMessage, agentFeeAcceptedMessage } from '@/lib/utils/phone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listing_id, agent_id, contact_type, name, phone: userPhone } = body;

    if (!listing_id || !agent_id) {
      return NextResponse.json(
        { error: 'Missing listing_id or agent_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get client IP address and hash it
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Simple SHA-256 hash of IP using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

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

    // Fetch listing details to calculate commission and get agent details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('price, title')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Fetch agent to get WhatsApp and commission balance
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('whatsapp, phone, commission_balance')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Record the lead if not a duplicate
    if (!isDuplicate) {
      const { error: leadError } = await supabase.from('leads').insert({
        listing_id,
        agent_id,
        clicked_at: new Date().toISOString(),
        ip_hash: ipHash,
        contact_type: contact_type || null,
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

      // Calculate commission (10% of monthly listing price or flat rate of KSh 1,000)
      const commissionAmount = Math.max(1000, Math.round(listing.price * 0.1));

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

    // Determine WhatsApp number and build contextual message
    const formattedPhone = agent.whatsapp || agent.phone || '';
    const waPhone = cleanPhone(formattedPhone);

    let message: string;
    if (contact_type === 'hostel_owner') {
      // hostel_owner: use landlord_phone if available, else agent phone
      const { data: listingFull } = await supabase
        .from('listings')
        .select('landlord_phone')
        .eq('id', listing_id)
        .single();
      const ownerPhone = listingFull?.landlord_phone
        ? cleanPhone(listingFull.landlord_phone)
        : waPhone;
      message = hostelOwnerMessage(listing.title);
      const whatsappUrl = buildWhatsAppUrl(ownerPhone, message);
      return NextResponse.json({ success: true, whatsappUrl });
    } else if (contact_type === 'rumia_agent') {
      // Determine if fee was accepted (non-commission hostel)
      const feeAccepted = body.fee_accepted === true;
      const { data: agentRow } = await supabase
        .from('agents')
        .select('name')
        .eq('id', agent_id)
        .single();
      const agentName = agentRow?.name || 'your agent';
      message = feeAccepted
        ? agentFeeAcceptedMessage(listing.title, agentName)
        : agentInquiryMessage(listing.title, agentName);
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
      { status: 500 }
    );
  }
}
