-- Seed test agent users in Supabase Auth
-- Password for both: password123 (bcrypt hash)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'agent1@rumia.co.ke',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{}'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'agent2@rumia.co.ke',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{}'
)
ON CONFLICT (id) DO NOTHING;

-- Insert identities for the users (required for email/password login)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"agent1@rumia.co.ke"}',
  'email',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NOW(),
  NOW(),
  NOW()
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"agent2@rumia.co.ke"}',
  'email',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Seed Agent Profiles
INSERT INTO agents (id, user_id, name, phone, whatsapp, commission_balance)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'James Mwangi', '+254712345678', '+254712345678', 2500),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Grace Wanjiku', '+254723456789', '+254723456789', 0)
ON CONFLICT (id) DO NOTHING;

-- Seed Listings for Agent 1 (James)
INSERT INTO listings (id, title, description, price, location, agent_id, is_active, landlord_phone, room_type, amenities, bathroom_type, distance_to_campus, security_type, electricity_included, water_included, wifi_included, latitude, longitude)
VALUES
  (
    'aaa11111-1111-1111-1111-111111111111',
    'Sunrise Hostel – Gate C, Juja',
    'Newly renovated single and double rooms just 3 minutes from JKUAT Gate C. Includes spacious balcony, study desk, and 24/7 water supply. Ideal for focused students seeking a quiet environment close to campus.',
    7500,
    'Juja, Gate C',
    '11111111-1111-1111-1111-111111111111',
    true,
    '+254712345678',
    'Single',
    ARRAY['WiFi','Water','Security','Study Area'],
    'Shared',
    '3 mins walk',
    '24/7 CCTV & Guards',
    true, true, true,
    -1.0921, 37.0126
  ),
  (
    'aaa22222-2222-2222-2222-222222222222',
    'Greenview Apartments – Madaraka',
    'Self-contained studio apartments with private bathroom, kitchenette, and reliable electricity. Perfect for final-year students and postgrads who prefer privacy and independence.',
    15000,
    'Madaraka Estate, Nairobi',
    '11111111-1111-1111-1111-111111111111',
    true,
    '+254712345678',
    'Self-Contained',
    ARRAY['WiFi','Water','Electricity','Security','Parking','Kitchen'],
    'Private',
    '10 mins matatu',
    'Gated Community + Watchman',
    true, true, true,
    -1.3041, 36.8381
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Listings for Agent 2 (Grace)
INSERT INTO listings (id, title, description, price, location, agent_id, is_active, landlord_phone, room_type, amenities, bathroom_type, distance_to_campus, security_type, electricity_included, water_included, wifi_included, latitude, longitude)
VALUES
  (
    'bbb11111-1111-1111-1111-111111111111',
    'Campus Edge Bedsitter – Juja Town',
    'Affordable bedsitter with shared bathroom, close to shopping center and campus shuttle route. Great budget option with clean water and security.',
    5500,
    'Juja Town Centre',
    '22222222-2222-2222-2222-222222222222',
    true,
    '+254723456789',
    'Single',
    ARRAY['Water','Security'],
    'Shared',
    '7 mins walk',
    'Night Watchman',
    false, true, false,
    -1.0975, 37.0100
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Listing Images
INSERT INTO listing_images (listing_id, r2_url, display_order, category)
VALUES
  ('aaa11111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=600', 0, 'Room'),
  ('aaa11111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=600', 1, 'Exterior'),
  ('aaa22222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=600', 0, 'Room'),
  ('aaa22222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=600', 1, 'Bathroom'),
  ('bbb11111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600', 0, 'Room')
ON CONFLICT DO NOTHING;

-- Seed Room Types
INSERT INTO listing_room_types (listing_id, room_type, price, is_available)
VALUES
  ('aaa11111-1111-1111-1111-111111111111', 'Single Room', 7500, true),
  ('aaa11111-1111-1111-1111-111111111111', 'Double Room', 5000, true),
  ('aaa22222-2222-2222-2222-222222222222', 'Self-Contained Studio', 15000, true),
  ('aaa22222-2222-2222-2222-222222222222', 'Self-Contained 1BR', 18000, false),
  ('bbb11111-1111-1111-1111-111111111111', 'Single Bedsitter', 5500, true)
ON CONFLICT DO NOTHING;

-- Seed some Leads for Agent 1 (to show dashboard stats)
INSERT INTO leads (listing_id, agent_id, clicked_at, ip_hash)
VALUES
  ('aaa11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW() - interval '1 day', 'hash_abc_1'),
  ('aaa11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW() - interval '3 days', 'hash_abc_2'),
  ('aaa22222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW() - interval '2 days', 'hash_def_1'),
  ('aaa11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW() - interval '15 days', 'hash_abc_3')
ON CONFLICT DO NOTHING;

-- Seed a Commission entry for Agent 1
INSERT INTO commissions (agent_id, listing_id, amount, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaa11111-1111-1111-1111-111111111111', 2500, 'pending')
ON CONFLICT DO NOTHING;
