/**
 * Rumia Admin Panel — Test Data Seed Script
 *
 * Creates 3 agents, 9 listings (3 per agent), leads, and commissions.
 * Includes youtube_id, slug, county, area, gender, proximity_description,
 * and room_type_enum on every listing for end-to-end coverage.
 *
 * Run with:
 *   pnpm exec tsx scripts/seed-test-data.ts
 *   pnpm exec tsx scripts/seed-test-data.ts --cleanup
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = new Set(process.argv.slice(2));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function randomTimestampThisMonth(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return new Date(
    start + Math.random() * (now.getTime() - start),
  ).toISOString();
}

function fakeIpHash(seed: number): string {
  return seed.toString(16).padStart(2, '0').repeat(32).substring(0, 64);
}

function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function deleteRows(
  table: string,
  column: string,
  values: string[],
): Promise<number> {
  const ids = unique(values);
  if (ids.length === 0) return 0;

  const { error } = await supabase.from(table).delete().in(column, ids);
  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }

  return ids.length;
}

async function assertRequiredSchema() {
  const checks = [
    {
      label: 'agents profile fields',
      query: supabase
        .from('agents')
        .select('id, user_id, status, slug')
        .limit(1),
    },
    {
      label: 'listing SEO/search fields',
      query: supabase
        .from('listings')
        .select(
          'id, slug, county, area, gender, proximity_description, room_type_enum, youtube_id',
        )
        .limit(1),
    },
    {
      label: 'listing room type fields',
      query: supabase
        .from('listing_room_types')
        .select('id, listing_id, room_type, price, is_available')
        .limit(1),
    },
  ];

  for (const check of checks) {
    const { error } = await check.query;
    if (error) {
      console.error(
        `❌ Missing required schema for ${check.label}: ${error.message}`,
      );
      console.error(
        '   Run Supabase migrations first, then rerun: pnpm exec tsx scripts/seed-test-data.ts',
      );
      process.exit(1);
    }
  }
}

// ─── Test Agent Definitions ───────────────────────────────────────────────────

const TEST_ADMINS = [
  {
    email: 'admin@rumia.co.ke',
    password: 'password123',
  },
];

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

// ─── Listing Templates (3 per agent = 9 total) ────────────────────────────────
// All listings use county=nyeri, area=dekut so they appear on /hostels/nyeri/dekut
// and /hostels search page.

const LISTING_TEMPLATES = [
  // ── James Kariuki (agent index 0) ─────────────────────────────────────────
  {
    agentIndex: 0,
    title: 'Kariuki Gardens — Self Contained',
    description:
      'Modern self-contained rooms 3 minutes walk from DeKUT Gate A along Gichugu Road. Private bathroom, free fibre WiFi, 24/7 borehole water, CCTV security, and a spacious study desk. Ideal for second and third-year students who need privacy.',
    price: 12000,
    location: 'Gichugu Road, Near DeKUT Gate A, Nyeri',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Self-Contained',
    room_type_enum: 'self_contained',
    gender: 'mixed',
    proximity_description: '3 mins walk to DeKUT Gate A',
    is_active: true,
    latitude: -0.4167,
    longitude: 36.95,
    youtube_id: 'qL0Z3sGXBas',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
        category: 'Kitchen',
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
        category: 'Bathroom',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Common Area',
      },
    ],
    room_types: [
      { room_type: 'Self-Contained Single', price: 12000, is_available: true },
      { room_type: 'Self-Contained Double', price: 14000, is_available: true },
    ],
  },
  {
    agentIndex: 0,
    title: 'Sunrise Bedsitter — Nyaribo',
    description:
      'Affordable bedsitter units in Nyaribo, 7 minutes from DeKUT main gate. Tiled floors, modern fittings, consistent borehole water, and a night watchman. Great for students on a budget.',
    price: 7500,
    location: 'Nyaribo, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Bedsitter',
    room_type_enum: 'bedsitter',
    gender: 'mixed',
    proximity_description: '7 mins walk to DeKUT main gate',
    is_active: true,
    latitude: -0.421,
    longitude: 36.948,
    youtube_id: 'DczLkNIRgFE',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=800',
        category: 'Common Area',
      },
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Bathroom',
      },
    ],
    room_types: [{ room_type: 'Bedsitter', price: 7500, is_available: true }],
  },
  {
    agentIndex: 0,
    title: 'Kariuki Annex — Single Rooms',
    description:
      'Clean single rooms with shared ablution along Boma Road, 5 minutes from DeKUT. Borehole water, backup power, communal kitchen, and secure perimeter wall. Great for first-year students.',
    price: 5000,
    location: 'Boma Road, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Single Room',
    room_type_enum: 'single',
    gender: 'male',
    proximity_description: '5 mins walk to DeKUT Gate B',
    is_active: true,
    latitude: -0.419,
    longitude: 36.952,
    youtube_id: 'K4TOrB7at0Y',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
        category: 'Bathroom',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Common Area',
      },
    ],
    room_types: [
      { room_type: 'Single Room', price: 5000, is_available: true },
      { room_type: 'Double Room', price: 4000, is_available: true },
    ],
  },

  // ── Amina Odhiambo (agent index 1) ────────────────────────────────────────
  {
    agentIndex: 1,
    title: 'Amina Court — Studio Apartment',
    description:
      'Fully furnished studio apartments on Gichugu Road, a 4-minute walk from DeKUT Gate A. Backup generator, borehole water, fibre internet, and secure parking. Perfect for postgrad students and working professionals.',
    price: 18000,
    location: 'Gichugu Road, Nyeri — Near DeKUT Gate A',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Studio',
    room_type_enum: 'self_contained',
    gender: 'mixed',
    proximity_description: '4 mins walk to DeKUT Gate A',
    is_active: true,
    latitude: -0.4155,
    longitude: 36.951,
    youtube_id: 'LXb3EKWsInQ',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Kitchen',
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
        category: 'Bathroom',
      },
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Common Area',
      },
    ],
    room_types: [{ room_type: 'Studio', price: 18000, is_available: true }],
  },
  {
    agentIndex: 1,
    title: 'Nyeri View Heights — 1 Bedroom',
    description:
      'Spacious one-bedroom unit with a balcony overlooking Nyeri town. Quiet environment, ample parking, 10 minutes from DeKUT. Currently under new management — available from next month.',
    price: 20000,
    location: 'Nyeri View, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'One Bedroom',
    room_type_enum: 'self_contained',
    gender: 'mixed',
    proximity_description: '10 mins matatu to DeKUT',
    is_active: false,
    latitude: -0.423,
    longitude: 36.9455,
    youtube_id: 'rO9bMQxmV2E',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Kitchen',
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
        category: 'Bathroom',
      },
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
        category: 'Room',
      },
    ],
    room_types: [
      { room_type: 'One Bedroom', price: 20000, is_available: false },
    ],
  },
  {
    agentIndex: 1,
    title: 'Amina Ladies Hostel — Nyaribo',
    description:
      'Female-only hostel in Nyaribo, 6 minutes from DeKUT. Safe, clean, and well-lit with CCTV. Communal kitchen, laundry room, and 24/7 guard. Popular with first and second-year ladies.',
    price: 6500,
    location: 'Nyaribo, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Single Room',
    room_type_enum: 'single',
    gender: 'female',
    proximity_description: '6 mins walk to DeKUT main gate',
    is_active: true,
    latitude: -0.42,
    longitude: 36.949,
    youtube_id: 'qL0Z3sGXBas',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Common Area',
      },
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
        category: 'Kitchen',
      },
    ],
    room_types: [
      { room_type: 'Single Room', price: 6500, is_available: true },
      { room_type: 'Shared Double', price: 4500, is_available: true },
    ],
  },

  // ── Brian Mutua (agent index 2) ────────────────────────────────────────────
  {
    agentIndex: 2,
    title: 'Mutua Annexe — Single Room',
    description:
      'Budget-friendly single rooms along Gichugu Road, 8 minutes from DeKUT Gate A. Good transport links, reliable borehole water, and a secure compound with night guard.',
    price: 4500,
    location: 'Gichugu Road, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Single Room',
    room_type_enum: 'single',
    gender: 'mixed',
    proximity_description: '8 mins walk to DeKUT Gate A',
    is_active: true,
    latitude: -0.4175,
    longitude: 36.953,
    youtube_id: 'DczLkNIRgFE',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=800',
        category: 'Common Area',
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
        category: 'Bathroom',
      },
    ],
    room_types: [{ room_type: 'Single Room', price: 4500, is_available: true }],
  },
  {
    agentIndex: 2,
    title: 'Eastern View — Bedsitter',
    description:
      'Newly renovated bedsitter units near DeKUT on Boma Road. Tiled floors, reliable water supply, security lights, and a night watchman. Close to shops and stage.',
    price: 5500,
    location: 'Boma Road, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Bedsitter',
    room_type_enum: 'bedsitter',
    gender: 'mixed',
    proximity_description: '6 mins walk to DeKUT Gate B',
    is_active: true,
    latitude: -0.4185,
    longitude: 36.9515,
    youtube_id: 'K4TOrB7at0Y',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
        category: 'Kitchen',
      },
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Common Area',
      },
    ],
    room_types: [{ room_type: 'Bedsitter', price: 5500, is_available: true }],
  },
  {
    agentIndex: 2,
    title: 'Mutua Guestrooms — Shared Double',
    description:
      'Affordable shared double rooms near DeKUT, popular with first-year students. Spacious rooms with built-in wardrobes, communal showers, and a borehole. 10 minutes walk to campus.',
    price: 3000,
    location: 'Nyaribo, Nyeri — Near DeKUT',
    county: 'nyeri',
    area: 'dekut',
    room_type: 'Shared',
    room_type_enum: 'shared',
    gender: 'male',
    proximity_description: '10 mins walk to DeKUT main gate',
    is_active: true,
    latitude: -0.422,
    longitude: 36.947,
    youtube_id: 'LXb3EKWsInQ',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
        category: 'Exterior',
      },
      {
        url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800',
        category: 'Room',
      },
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800',
        category: 'Common Area',
      },
      {
        url: 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=800',
        category: 'Bathroom',
      },
    ],
    room_types: [
      {
        room_type: 'Shared Double (per person)',
        price: 3000,
        is_available: true,
      },
      {
        room_type: 'Shared Triple (per person)',
        price: 2500,
        is_available: true,
      },
    ],
  },
];

const LEGACY_SEED_LISTING_IDS = [
  'aaa11111-1111-1111-1111-111111111111',
  'aaa22222-2222-2222-2222-222222222222',
  'bbb11111-1111-1111-1111-111111111111',
];

const LEGACY_SEED_LISTING_TITLES = [
  'Sunrise Hostel – Gate C, Juja',
  'Greenview Apartments – Madaraka',
  'Campus Edge Bedsitter – Juja Town',
  'Sunrise Bedsitter — Thika Road',
  'Lavington Heights — 1 Bedroom',
  'Amina Ladies Hostel — Parklands',
];

const SEED_AUTH_EMAILS = [...TEST_ADMINS, ...TEST_AGENTS].map((account) =>
  account.email.toLowerCase(),
);

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function cleanupSeedData() {
  console.log('🧹 Cleaning Rumia end-to-end test seed data...\n');

  await assertRequiredSchema();

  const {
    data: { users },
    error: listErr,
  } = await supabase.auth.admin.listUsers();

  if (listErr) {
    console.error('❌ Could not list auth users:', listErr.message);
    process.exit(1);
  }

  const seedAuthUsers = users.filter(
    (user) => user.email && SEED_AUTH_EMAILS.includes(user.email.toLowerCase()),
  );
  const seedUserIds = seedAuthUsers.map((user) => user.id);
  const seedPhones = TEST_AGENTS.map((agent) => agent.phone);

  const agentQueries = [];
  if (seedUserIds.length > 0) {
    agentQueries.push(
      supabase.from('agents').select('id').in('user_id', seedUserIds),
    );
  }
  agentQueries.push(
    supabase.from('agents').select('id').in('phone', seedPhones),
  );

  const agentResults = await Promise.all(agentQueries);
  for (const result of agentResults) {
    if (result.error) {
      console.error(`❌ Could not find seeded agents: ${result.error.message}`);
      process.exit(1);
    }
  }

  const agentIds = unique(
    agentResults.flatMap((result) => (result.data ?? []).map((row) => row.id)),
  );

  let listingIds: string[] = [];
  if (agentIds.length > 0) {
    const { data: listings, error: listingLookupError } = await supabase
      .from('listings')
      .select('id')
      .in('agent_id', agentIds);

    if (listingLookupError) {
      console.error(
        `❌ Could not find seeded listings: ${listingLookupError.message}`,
      );
      process.exit(1);
    }

    listingIds = (listings ?? []).map((listing) => listing.id);
  }

  try {
    await deleteRows('leads', 'agent_id', agentIds);
    await deleteRows('commissions', 'agent_id', agentIds);
    await deleteRows('listing_images', 'listing_id', listingIds);
    await deleteRows('listing_room_types', 'listing_id', listingIds);
    await deleteRows('listings', 'id', listingIds);
    await deleteRows('agents', 'id', agentIds);
  } catch (err) {
    console.error(
      `❌ Cleanup failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    process.exit(1);
  }

  for (const user of seedAuthUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(
        `❌ Failed to delete auth user ${user.email}: ${error.message}`,
      );
      process.exit(1);
    }
  }

  console.log('✅ Cleanup complete');
  console.log(`   Auth users removed: ${seedAuthUsers.length}`);
  console.log(`   Agents removed:     ${agentIds.length}`);
  console.log(`   Listings removed:   ${listingIds.length}`);
  console.log(
    '\nRun pnpm exec tsx scripts/seed-test-data.ts to recreate test data.\n',
  );
}

async function seed() {
  console.log('🌱 Starting Rumia end-to-end test seed...\n');

  await assertRequiredSchema();

  // ── 1. Fetch existing auth users ─────────────────────────────────────────
  const {
    data: { users: existingAuthUsers },
    error: listErr,
  } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Could not list auth users:', listErr.message);
    process.exit(1);
  }

  // ── 2. Create / refresh seeded admin auth users ──────────────────────────
  for (const adminDef of TEST_ADMINS) {
    console.log(`🔐 Processing admin: ${adminDef.email}`);

    const existingAuthUser = existingAuthUsers.find(
      (u) => u.email === adminDef.email,
    );

    if (existingAuthUser) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(existingAuthUser.id, {
          password: adminDef.password,
          email_confirm: true,
        });

      if (authUpdateError) {
        console.error(
          `   ❌ Failed to refresh admin login: ${authUpdateError.message}`,
        );
        process.exit(1);
      }

      console.log(`   Admin auth login refreshed (${existingAuthUser.id})`);
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: adminDef.email,
          password: adminDef.password,
          email_confirm: true,
        });

      if (authError || !authData.user) {
        console.error(
          `   ❌ Failed to create admin auth user: ${authError?.message}`,
        );
        process.exit(1);
      }

      console.log(`   ✅ Created admin auth user (${authData.user.id})`);
    }
  }

  // ── 2. Create / upsert agents ────────────────────────────────────────────
  const agentIds: string[] = [];

  for (const agentDef of TEST_AGENTS) {
    console.log(`👤 Processing agent: ${agentDef.name} (${agentDef.email})`);

    let userId: string;
    const existingAuthUser = existingAuthUsers.find(
      (u) => u.email === agentDef.email,
    );

    if (existingAuthUser) {
      console.log(`   Auth user already exists (${existingAuthUser.id})`);
      userId = existingAuthUser.id;

      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(userId, {
          password: agentDef.password,
          email_confirm: true,
        });

      if (authUpdateError) {
        console.error(
          `   ❌ Failed to refresh auth login: ${authUpdateError.message}`,
        );
        continue;
      }

      console.log('   Auth login refreshed');
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: agentDef.email,
          password: agentDef.password,
          email_confirm: true,
        });
      if (authError || !authData.user) {
        console.error(
          `   ❌ Failed to create auth user: ${authError?.message}`,
        );
        continue;
      }
      userId = authData.user.id;
      console.log(`   ✅ Created auth user (${userId})`);
    }

    const agentSlug = slugify(agentDef.name);
    const agentProfile = {
      user_id: userId,
      name: agentDef.name,
      phone: agentDef.phone,
      whatsapp: agentDef.whatsapp,
      status: agentDef.status,
      slug: agentSlug,
    };

    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let agentId: string;

    if (existingAgent) {
      const { error: agentUpdateError } = await supabase
        .from('agents')
        .update(agentProfile)
        .eq('id', existingAgent.id);

      if (agentUpdateError) {
        console.error(
          `   ❌ Failed to update agent: ${agentUpdateError.message}`,
        );
        continue;
      }

      agentId = existingAgent.id;
      console.log(`   Agent profile already exists (${agentId}) — updated`);
    } else {
      const { data: newAgent, error: agentError } = await supabase
        .from('agents')
        .insert({
          ...agentProfile,
          commission_balance: 0,
        })
        .select('id')
        .single();

      if (agentError || !newAgent) {
        console.error(`   ❌ Failed to create agent: ${agentError?.message}`);
        continue;
      }
      agentId = newAgent.id;
      console.log(`   ✅ Created agent (${agentId})`);
    }

    agentIds.push(agentId);
  }

  if (agentIds.length < 3) {
    console.error('\n❌ Not all agents were created.');
    process.exit(1);
  }

  console.log(`\n✅ Agents ready: ${agentIds.join(', ')}\n`);

  const { error: legacyCleanupError } = await supabase
    .from('listings')
    .delete()
    .in('agent_id', agentIds)
    .in('id', LEGACY_SEED_LISTING_IDS);

  const { error: legacyTitleCleanupError } = await supabase
    .from('listings')
    .delete()
    .in('agent_id', agentIds)
    .in('title', LEGACY_SEED_LISTING_TITLES);

  if (legacyCleanupError) {
    console.error(
      `❌ Failed to remove legacy seed listings: ${legacyCleanupError.message}`,
    );
  } else if (legacyTitleCleanupError) {
    console.error(
      `❌ Failed to remove legacy titled listings: ${legacyTitleCleanupError.message}`,
    );
  } else {
    console.log('🧹 Legacy Juja/Nairobi seed listings removed if present\n');
  }

  // ── 3. Create listings ────────────────────────────────────────────────────
  const listingIds: string[] = [];
  let listingFailures = 0;

  for (const t of LISTING_TEMPLATES) {
    const agentId = agentIds[t.agentIndex];
    const listingSlug = `${slugify(t.title)}-${slugify(t.area)}`;

    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('agent_id', agentId)
      .eq('title', t.title)
      .maybeSingle();

    if (existing) {
      const { error: listingUpdateError } = await supabase
        .from('listings')
        .update({
          title: t.title,
          slug: listingSlug,
          description: t.description,
          price: t.price,
          location: t.location,
          county: t.county,
          area: t.area,
          landlord_phone: TEST_AGENTS[t.agentIndex].phone,
          room_type: t.room_type,
          youtube_id: t.youtube_id,
          gender: t.gender,
          proximity_description: t.proximity_description,
          room_type_enum: t.room_type_enum,
          amenities: ['WiFi', 'Water', 'Security', 'Parking'],
          bathroom_type:
            t.room_type_enum === 'self_contained' ? 'Private' : 'Shared',
          distance_to_campus: t.proximity_description,
          security_type: 'CCTV & Guard',
          electricity_included: true,
          water_included: true,
          wifi_included: t.price >= 7000,
          latitude: t.latitude,
          longitude: t.longitude,
          is_active: t.is_active,
        })
        .eq('id', existing.id);

      if (listingUpdateError) {
        console.error(
          `❌ Failed to update "${t.title}": ${listingUpdateError.message}`,
        );
        listingIds.push('');
        listingFailures++;
        continue;
      }

      // Replace related records so existing hostels also get the full set.
      const { error: imageDeleteError } = await supabase
        .from('listing_images')
        .delete()
        .eq('listing_id', existing.id);

      const { error: imageInsertError } = await supabase
        .from('listing_images')
        .insert(
          t.images.map((img, idx) => ({
            listing_id: existing.id,
            r2_url: img.url,
            display_order: idx,
            category: img.category,
          })),
        );

      const { error: roomTypeDeleteError } = await supabase
        .from('listing_room_types')
        .delete()
        .eq('listing_id', existing.id);

      let roomTypeInsertError;
      if (!roomTypeDeleteError) {
        const result = await supabase.from('listing_room_types').insert(
          t.room_types.map((rt) => ({
            listing_id: existing.id,
            room_type: rt.room_type,
            price: rt.price,
            is_available: rt.is_available,
          })),
        );
        roomTypeInsertError = result.error;
      }

      const relatedError =
        imageDeleteError ||
        imageInsertError ||
        roomTypeDeleteError ||
        roomTypeInsertError;

      if (relatedError) {
        console.error(
          `❌ Failed to refresh related data for "${t.title}": ${relatedError.message}`,
        );
        listingIds.push('');
        listingFailures++;
        continue;
      }

      console.log(
        `🏠 Updated "${t.title}" — ${t.images.length} images, ${t.room_types.length} room types, YouTube ${youtubeUrl(t.youtube_id)}`,
      );
      listingIds.push(existing.id);
      continue;
    }

    const { data: newListing, error: listingError } = await supabase
      .from('listings')
      .insert({
        title: t.title,
        slug: listingSlug,
        description: t.description,
        price: t.price,
        location: t.location,
        county: t.county,
        area: t.area,
        agent_id: agentId,
        youtube_id: t.youtube_id,
        is_active: t.is_active,
        landlord_phone: TEST_AGENTS[t.agentIndex].phone,
        room_type: t.room_type,
        room_type_enum: t.room_type_enum,
        gender: t.gender,
        proximity_description: t.proximity_description,
        amenities: ['WiFi', 'Water', 'Security', 'Parking'],
        bathroom_type:
          t.room_type_enum === 'self_contained' ? 'Private' : 'Shared',
        distance_to_campus: t.proximity_description,
        security_type: 'CCTV & Guard',
        electricity_included: true,
        water_included: true,
        wifi_included: t.price >= 7000,
        latitude: t.latitude,
        longitude: t.longitude,
      })
      .select('id')
      .single();

    if (listingError || !newListing) {
      console.error(
        `❌ Failed to create "${t.title}": ${listingError?.message}`,
      );
      listingIds.push('');
      listingFailures++;
      continue;
    }

    // All images in one batch insert
    const { error: imageInsertError } = await supabase
      .from('listing_images')
      .insert(
        t.images.map((img, idx) => ({
          listing_id: newListing.id,
          r2_url: img.url,
          display_order: idx,
          category: img.category,
        })),
      );

    // Room types
    const { error: roomTypeInsertError } = await supabase
      .from('listing_room_types')
      .insert(
        t.room_types.map((rt) => ({
          listing_id: newListing.id,
          room_type: rt.room_type,
          price: rt.price,
          is_available: rt.is_available,
        })),
      );

    const relatedError = imageInsertError || roomTypeInsertError;

    if (relatedError) {
      console.error(
        `❌ Failed to attach related data for "${t.title}": ${relatedError.message}`,
      );
      listingIds.push('');
      listingFailures++;
      continue;
    }

    listingIds.push(newListing.id);
    console.log(
      `✅ Created listing: "${t.title}" — ${t.images.length} images, YouTube ${youtubeUrl(t.youtube_id)} (${newListing.id})`,
    );
  }

  console.log(
    `\n✅ Listings ready: ${listingIds.filter(Boolean).length} total\n`,
  );

  if (listingFailures > 0) {
    console.error(
      `❌ Seed stopped because ${listingFailures} listing(s) failed.`,
    );
    process.exit(1);
  }

  // ── 4. Leads (active listings only) ──────────────────────────────────────
  // Target counts per listing index
  const leadDistribution: Array<{ idx: number; count: number }> = [
    { idx: 0, count: 7 }, // Kariuki Gardens
    { idx: 1, count: 5 }, // Sunrise Bedsitter
    { idx: 2, count: 4 }, // Kariuki Annex
    { idx: 3, count: 6 }, // Amina Court
    { idx: 5, count: 4 }, // Amina Ladies Hostel
    { idx: 6, count: 5 }, // Mutua Annexe
    { idx: 7, count: 4 }, // Eastern View
    { idx: 8, count: 3 }, // Mutua Guestrooms
  ];

  let leadsCreated = 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  for (const { idx, count } of leadDistribution) {
    const template = LISTING_TEMPLATES[idx];
    const listingId = listingIds[idx];
    const agentId = agentIds[template.agentIndex];
    if (!listingId || !agentId) continue;

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
        ip_hash: fakeIpHash(idx * 100 + i + existing),
      });
      if (!error) leadsCreated++;
    }

    console.log(
      `Leads for "${template.title}": ${existing + toCreate} total (${toCreate} new)`,
    );
  }

  console.log(`\n ${leadsCreated} new leads created\n`);

  // ── 5. Commissions (2 per agent: 1 pending + 1 paid) ─────────────────────
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
      paid_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      agentIndex: 0,
      listingIndex: 2,
      amount: 500,
      status: 'pending',
      paid_at: null,
    },
    // Amina
    {
      agentIndex: 1,
      listingIndex: 3,
      amount: 2200,
      status: 'pending',
      paid_at: null,
    },
    {
      agentIndex: 1,
      listingIndex: 3,
      amount: 2200,
      status: 'paid',
      paid_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      agentIndex: 1,
      listingIndex: 5,
      amount: 900,
      status: 'pending',
      paid_at: null,
    },
    // Brian
    {
      agentIndex: 2,
      listingIndex: 6,
      amount: 550,
      status: 'pending',
      paid_at: null,
    },
    {
      agentIndex: 2,
      listingIndex: 7,
      amount: 600,
      status: 'paid',
      paid_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      agentIndex: 2,
      listingIndex: 8,
      amount: 350,
      status: 'pending',
      paid_at: null,
    },
  ];

  const expectedCommissionKeys = new Set(
    commissionTemplates
      .map((ct) => {
        const agentId = agentIds[ct.agentIndex];
        const listingId = listingIds[ct.listingIndex];
        if (!agentId || !listingId) return null;
        return `${agentId}:${listingId}:${ct.amount}:${ct.status}`;
      })
      .filter(Boolean),
  );

  const { data: existingSeedCommissions, error: staleCommissionLookupError } =
    await supabase
      .from('commissions')
      .select('id, agent_id, listing_id, amount, status')
      .in('agent_id', agentIds);

  if (staleCommissionLookupError) {
    console.error(
      `❌ Stale commission lookup failed: ${staleCommissionLookupError.message}`,
    );
    process.exit(1);
  }

  const staleCommissionIds = (existingSeedCommissions ?? [])
    .filter((row) => {
      const key = `${row.agent_id}:${row.listing_id}:${Number(row.amount)}:${row.status}`;
      return !expectedCommissionKeys.has(key);
    })
    .map((row) => row.id);

  if (staleCommissionIds.length > 0) {
    const { error: staleCommissionDeleteError } = await supabase
      .from('commissions')
      .delete()
      .in('id', staleCommissionIds);

    if (staleCommissionDeleteError) {
      console.error(
        `❌ Failed to remove stale commissions: ${staleCommissionDeleteError.message}`,
      );
      process.exit(1);
    }

    console.log(
      `🧹 Removed ${staleCommissionIds.length} stale commission(s) not in the current seed template`,
    );
  }

  let commissionsCreated = 0;

  for (const ct of commissionTemplates) {
    const agentId = agentIds[ct.agentIndex];
    const listingId = listingIds[ct.listingIndex];
    if (!agentId || !listingId) continue;

    const { data: existingRows, error: existingCommissionError } =
      await supabase
        .from('commissions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('listing_id', listingId)
        .eq('amount', ct.amount)
        .eq('status', ct.status)
        .order('created_at', { ascending: true });

    if (existingCommissionError) {
      console.error(
        `❌ Commission lookup failed: ${existingCommissionError.message}`,
      );
      continue;
    }

    if (existingRows && existingRows.length > 0) {
      const duplicateIds = existingRows.slice(1).map((row) => row.id);

      if (duplicateIds.length > 0) {
        const { error: duplicateDeleteError } = await supabase
          .from('commissions')
          .delete()
          .in('id', duplicateIds);

        if (duplicateDeleteError) {
          console.error(
            `❌ Failed to remove duplicate commissions: ${duplicateDeleteError.message}`,
          );
          continue;
        }
      }

      console.log(
        `💰 Commission already exists: KES ${ct.amount} (${ct.status})${
          duplicateIds.length > 0
            ? ` — removed ${duplicateIds.length} duplicate(s)`
            : ''
        }`,
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
      console.error(`❌ Commission insert failed: ${error.message}`);
    } else {
      commissionsCreated++;
      console.log(
        `✅ Commission: KES ${ct.amount} — ${ct.status} (${TEST_AGENTS[ct.agentIndex].name})`,
      );
    }
  }

  console.log(`\n✅ ${commissionsCreated} new commissions created\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('✅  Seed complete!\n');
  console.log('   Agents:      3 (James, Amina, Brian)');
  console.log('   Listings:    9 (3 per agent, 8 active, 1 inactive)');
  console.log('   YouTube IDs: set on all 9 listings');
  console.log('   Leads:       up to 38 this month');
  console.log('   Commissions: 9 (6 pending, 3 paid)');
  console.log('\n   Admin login:');
  console.log('   URL:      http://localhost:3000/auth/login');
  console.log(`   Email:    ${TEST_ADMINS[0].email}`);
  console.log(`   Password: ${TEST_ADMINS[0].password}`);
  console.log('   Required env: ADMIN_EMAILS=admin@rumia.co.ke');
  console.log('\n   Agent test logins:');
  console.log('   agent1@rumia.co.ke / password123  (James — active)');
  console.log('   agent2@rumia.co.ke / password123  (Amina — active)');
  console.log('   agent3@rumia.co.ke / password123  (Brian — suspended)');
  console.log('═══════════════════════════════════════════════════\n');
}

const runner = args.has('--cleanup') ? cleanupSeedData : seed;

runner().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
