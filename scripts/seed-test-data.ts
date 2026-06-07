/**
 * Rumia Admin Panel — Test Data Seed Script
 *
 * Creates 3 agents, 6 listings, 24 leads, and 6 commissions so every
 * section of the admin panel has realistic data to display.
 *
 * Run with:
 *   pnpm exec tsx scripts/seed-test-data.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Test Agent Definitions ───────────────────────────────────────────────────

const TEST_AGENTS = [
  {
    email: 'agent1@rumia.co.ke',
    password: 'password123',
    name: 'James Kariuki',
    phone: '+254700000001',
    whatsapp: '+254700000001',
    status: 'active',
  },
  {
    email: 'agent2@rumia.co.ke',
    password: 'password123',
    name: 'Amina Odhiambo',
    phone: '+254700000002',
    whatsapp: '+254700000002',
    status: 'active',
  },
  {
    email: 'agent3@rumia.co.ke',
    password: 'password123',
    name: 'Brian Mutua',
    phone: '+254700000003',
    whatsapp: '+254700000003',
    status: 'suspended',
  },
];

// ─── Listing Templates (2 per agent) ─────────────────────────────────────────

const LISTING_TEMPLATES = [
  // James Kariuki (agent index 0)
  {
    agentIndex: 0,
    title: 'Kariuki Gardens — Self Contained',
    description:
      'Modern self-contained rooms in the heart of Juja. 5 minutes walk from JKUAT main gate. Includes free WiFi, water, and 24/7 security.',
    price: 12000,
    location: 'Juja, Near JKUAT Gate C',
    is_active: true,
    room_type: 'Self-Contained',
    latitude: -1.0849,
    longitude: 37.0081,
    image_url:
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600',
  },
  {
    agentIndex: 0,
    title: 'Sunrise Bedsitter — Thika Road',
    description:
      'Affordable bedsitter units along Thika Road. Close to shopping centres and matatu terminus. All amenities included.',
    price: 7500,
    location: 'Thika Road, Roysambu',
    is_active: true,
    room_type: 'Bedsitter',
    latitude: -1.2186,
    longitude: 36.8846,
    image_url:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=600',
  },
  // Amina Odhiambo (agent index 1)
  {
    agentIndex: 1,
    title: 'Amina Court — Studio Apartment',
    description:
      'Fully furnished studio apartments in Westlands. Perfect for working professionals and students. Backup generator and borehole water.',
    price: 22000,
    location: 'Westlands, Nairobi',
    is_active: true,
    room_type: 'Studio',
    latitude: -1.2659,
    longitude: 36.8107,
    image_url:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=600',
  },
  {
    agentIndex: 1,
    title: 'Lavington Heights — 1 Bedroom',
    description:
      'Spacious one-bedroom unit in Lavington. Quiet neighbourhood, ample parking, and proximity to top schools.',
    price: 35000,
    location: 'Lavington, Nairobi',
    is_active: false, // Inactive — tests the inactive filter
    room_type: 'One Bedroom',
    latitude: -1.2876,
    longitude: 36.7806,
    image_url:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=600',
  },
  // Brian Mutua (agent index 2)
  {
    agentIndex: 2,
    title: 'Mutua Annexe — Single Room',
    description:
      'Budget-friendly single rooms in Embakasi. Close to JKIA. Good transport links and safe neighbourhood.',
    price: 5500,
    location: 'Embakasi, Nairobi',
    is_active: true,
    room_type: 'Single Room',
    latitude: -1.3176,
    longitude: 36.9123,
    image_url:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=600',
  },
  {
    agentIndex: 2,
    title: 'Eastern View — Bedsitter',
    description:
      'Clean bedsitter units in Eastlands. Newly renovated, tiled floors, and reliable water supply.',
    price: 6000,
    location: 'Eastlands, Nairobi',
    is_active: true,
    room_type: 'Bedsitter',
    latitude: -1.2841,
    longitude: 36.8665,
    image_url:
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=600',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a random ISO timestamp within the current calendar month */
function randomTimestampThisMonth(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = now.getTime();
  const ts = start + Math.random() * (end - start);
  return new Date(ts).toISOString();
}

/** Returns a fake SHA-256-style hex hash (64 chars) */
function fakeIpHash(seed: number): string {
  const base = seed.toString(16).padStart(2, '0');
  return (base.repeat(32)).substring(0, 64);
}

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting Rumia admin panel test seed...\n');

  // ── 1. Fetch existing auth users once ────────────────────────────────────
  const { data: { users: existingAuthUsers }, error: listErr } =
    await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Could not list auth users:', listErr.message);
    process.exit(1);
  }

  // ── 2. Create agents ─────────────────────────────────────────────────────
  const agentIds: string[] = [];

  for (const agentDef of TEST_AGENTS) {
    console.log(`👤 Processing agent: ${agentDef.name} (${agentDef.email})`);

    // 2a. Auth user
    let userId: string;
    const existingAuthUser = existingAuthUsers.find(
      (u) => u.email === agentDef.email
    );

    if (existingAuthUser) {
      console.log(`   Auth user already exists (${existingAuthUser.id})`);
      userId = existingAuthUser.id;
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: agentDef.email,
          password: agentDef.password,
          email_confirm: true,
        });
      if (authError || !authData.user) {
        console.error(`   ❌ Failed to create auth user: ${authError?.message}`);
        continue;
      }
      userId = authData.user.id;
      console.log(`   ✅ Created auth user (${userId})`);
    }

    // 2b. Agent profile
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let agentId: string;

    if (existingAgent) {
      // Update status in case it changed
      await supabase
        .from('agents')
        .update({ status: agentDef.status })
        .eq('id', existingAgent.id);
      agentId = existingAgent.id;
      console.log(`   Agent profile already exists (${agentId})`);
    } else {
      const { data: newAgent, error: agentError } = await supabase
        .from('agents')
        .insert({
          user_id: userId,
          name: agentDef.name,
          phone: agentDef.phone,
          whatsapp: agentDef.whatsapp,
          commission_balance: 0,
          status: agentDef.status,
        })
        .select('id')
        .single();

      if (agentError || !newAgent) {
        console.error(`   ❌ Failed to create agent profile: ${agentError?.message}`);
        continue;
      }
      agentId = newAgent.id;
      console.log(`   ✅ Created agent profile (${agentId})`);
    }

    agentIds.push(agentId);
  }

  if (agentIds.length < 3) {
    console.error('\n❌ Not all agents were created. Check errors above.');
    process.exit(1);
  }

  console.log(`\n✅ Agents ready: ${agentIds.join(', ')}\n`);

  // ── 3. Create listings ────────────────────────────────────────────────────
  const listingIds: string[] = [];

  for (const template of LISTING_TEMPLATES) {
    const agentId = agentIds[template.agentIndex];

    // Check if listing already exists by title + agent_id
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('agent_id', agentId)
      .eq('title', template.title)
      .maybeSingle();

    if (existing) {
      console.log(`🏠 Listing already exists: "${template.title}"`);
      listingIds.push(existing.id);
      continue;
    }

    const { data: newListing, error: listingError } = await supabase
      .from('listings')
      .insert({
        title: template.title,
        description: template.description,
        price: template.price,
        location: template.location,
        agent_id: agentId,
        is_active: template.is_active,
        landlord_phone: TEST_AGENTS[template.agentIndex].phone,
        room_type: template.room_type,
        amenities: ['WiFi', 'Water', 'Security', 'Parking'],
        bathroom_type: 'Private',
        distance_to_campus: '10 mins walk',
        security_type: 'CCTV & Guard',
        electricity_included: true,
        water_included: true,
        wifi_included: true,
        latitude: template.latitude,
        longitude: template.longitude,
      })
      .select('id')
      .single();

    if (listingError || !newListing) {
      console.error(
        `❌ Failed to create listing "${template.title}": ${listingError?.message}`
      );
      continue;
    }

    listingIds.push(newListing.id);

    // Cover image
    await supabase.from('listing_images').insert({
      listing_id: newListing.id,
      r2_url: template.image_url,
      display_order: 0,
      category: 'Room',
    });

    // Room type record
    await supabase.from('listing_room_types').insert({
      listing_id: newListing.id,
      room_type: template.room_type,
      price: template.price,
      is_available: true,
    });

    console.log(`✅ Created listing: "${template.title}" (${newListing.id})`);
  }

  console.log(`\n✅ Listings ready: ${listingIds.length} total\n`);

  // ── 4. Create leads (only on active listings) ─────────────────────────────
  // Distribution: James 10, Amina 8, Brian 6 = 24 total
  const activeListingIndexes = LISTING_TEMPLATES
    .map((t, i) => ({ ...t, listingId: listingIds[i] }))
    .filter((t) => t.is_active);

  const leadDistribution: Array<{ listingIndex: number; count: number }> = [
    { listingIndex: 0, count: 6 },  // James listing 1 — 6 leads
    { listingIndex: 1, count: 4 },  // James listing 2 — 4 leads
    { listingIndex: 2, count: 5 },  // Amina listing 1 — 5 leads
    { listingIndex: 4, count: 6 },  // Brian listing 1 — 6 leads
    { listingIndex: 5, count: 3 },  // Brian listing 2 — 3 leads
  ];

  let leadsCreated = 0;

  for (const { listingIndex, count } of leadDistribution) {
    const template = LISTING_TEMPLATES[listingIndex];
    const listingId = listingIds[listingIndex];
    const agentId = agentIds[template.agentIndex];

    if (!listingId || !agentId) continue;

    // Check how many leads already exist for this listing this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('listing_id', listingId)
      .gte('clicked_at', monthStart.toISOString());

    const existing = existingLeads?.length ?? 0;
    const toCreate = Math.max(0, count - existing);

    for (let i = 0; i < toCreate; i++) {
      const { error } = await supabase.from('leads').insert({
        listing_id: listingId,
        agent_id: agentId,
        clicked_at: randomTimestampThisMonth(),
        ip_hash: fakeIpHash(listingIndex * 100 + i + existing),
      });
      if (!error) leadsCreated++;
    }

    const total = existing + toCreate;
    console.log(
      `📱 Leads for "${template.title}": ${total} total (${toCreate} new)`
    );
  }

  console.log(`\n✅ ${leadsCreated} new leads created\n`);

  // ── 5. Create commissions ─────────────────────────────────────────────────
  // 2 commissions per active agent (1 pending, 1 paid) = 6 total
  const commissionTemplates = [
    // James
    {
      agentIndex: 0,
      listingIndex: 0,
      amount: 1200,
      status: 'pending',
      paid_at: null,
    },
    {
      agentIndex: 0,
      listingIndex: 1,
      amount: 750,
      status: 'paid',
      paid_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    },
    // Amina
    {
      agentIndex: 1,
      listingIndex: 2,
      amount: 2200,
      status: 'pending',
      paid_at: null,
    },
    {
      agentIndex: 1,
      listingIndex: 2,
      amount: 2200,
      status: 'paid',
      paid_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    },
    // Brian
    {
      agentIndex: 2,
      listingIndex: 4,
      amount: 550,
      status: 'pending',
      paid_at: null,
    },
    {
      agentIndex: 2,
      listingIndex: 5,
      amount: 600,
      status: 'pending',
      paid_at: null,
    },
  ];

  let commissionsCreated = 0;

  for (const ct of commissionTemplates) {
    const agentId = agentIds[ct.agentIndex];
    const listingId = listingIds[ct.listingIndex];

    if (!agentId || !listingId) continue;

    // Check if this exact commission already exists (by agent + listing + amount + status)
    const { data: existing } = await supabase
      .from('commissions')
      .select('id')
      .eq('agent_id', agentId)
      .eq('listing_id', listingId)
      .eq('amount', ct.amount)
      .eq('status', ct.status)
      .maybeSingle();

    if (existing) {
      console.log(
        `💰 Commission already exists: KES ${ct.amount} (${ct.status})`
      );
      continue;
    }

    const row: Record<string, unknown> = {
      agent_id: agentId,
      listing_id: listingId,
      amount: ct.amount,
      status: ct.status,
    };
    if (ct.paid_at) row.paid_at = ct.paid_at;

    const { error } = await supabase.from('commissions').insert(row);

    if (error) {
      console.error(`❌ Failed to insert commission: ${error.message}`);
    } else {
      commissionsCreated++;
      console.log(
        `✅ Commission: KES ${ct.amount} — ${ct.status} (${TEST_AGENTS[ct.agentIndex].name})`
      );
    }
  }

  console.log(`\n✅ ${commissionsCreated} new commissions created\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('✅  Seed complete! Here is what was set up:\n');
  console.log('   Agents:      3 (James, Amina, Brian)');
  console.log('   Listings:    6 (5 active, 1 inactive)');
  console.log('   Leads:       up to 24 this month');
  console.log('   Commissions: 6 (4 pending, 2 paid)');
  console.log('\n   Log in as admin:');
  console.log('   URL:      http://localhost:3000/auth/login');
  console.log('   Email:    paul.katam025@gmail.com');
  console.log('   Password: KAT4M@# Rumia');
  console.log('\n   Agent test login:');
  console.log('   Email:    agent1@rumia.co.ke');
  console.log('   Password: password123');
  console.log('═══════════════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
