-- Local development seed. NOT production data.
-- Creates legacy campuses/agents/listings for Nyeri, then projects them into the
-- new model (properties/units) via project_listing(). Safe to re-run: it deletes
-- its own rows first, identified by the phone/e-mail prefixes below.
BEGIN;

DELETE FROM listings
 WHERE agent_id IN (SELECT id FROM agents WHERE phone LIKE '+2547120000%' OR phone LIKE '+2547120001%');
DELETE FROM agents WHERE phone LIKE '+2547120000%' OR phone LIKE '+2547120001%';

INSERT INTO agents (name, phone, whatsapp, campus_id, slug)
SELECT v.name, v.phone, v.phone, (SELECT id FROM campuses WHERE slug = 'dekut'), v.slug
FROM (VALUES
  ('Mary Wanjiru',   '+254712000001', 'mary-wanjiru'),
  ('Peter Kamau',    '+254712000002', 'peter-kamau'),
  ('Grace Njeri',    '+254712000003', 'grace-njeri')
) AS v(name, phone, slug);

INSERT INTO listings
  (title, slug, description, property_type, price, location, county, area,
   specific_location, proximity_description, latitude, longitude,
   amenities, water_included, electricity_included, wifi_included, hot_water_included,
   agent_id, campus_id, is_active, pays_commission)
SELECT
  v.title, v.slug, v.description, 'hostel', v.price, v.location, 'nyeri', v.area,
  v.specific_location, v.proximity, v.lat, v.lng,
  v.amenities::text[], v.water, v.electricity, v.wifi, v.hotwater,
  (SELECT id FROM agents WHERE slug = v.agent_slug),
  (SELECT id FROM campuses WHERE slug = 'dekut'),
  true, false
FROM (VALUES
  ('Sunrise Hostel',  'sunrise-hostel',  'Bright rooms a short walk from the main gate. 24/7 water and security.',
   6500::numeric, 'Near Gate A', 'near-gate-a', 'Off the tarmac, behind the petrol station',
   '2 minutes to the main gate', -0.3946, 36.9642,
   '{wifi,security,cctv,study-room}', true, true, true, true, 'mary-wanjiru'),
  ('Green View Apartments', 'green-view-apartments', 'Quiet bedsitters with a shared kitchen and a rooftop study area.',
   8200::numeric, 'Boma', 'boma', 'Opposite the Boma shops',
   '10 minutes walk to campus', -0.3890, 36.9590,
   '{wifi,security,backup-generator}', true, true, true, false, 'peter-kamau'),
  ('Nyaribo Comfort',  'nyaribo-comfort',  'Spacious single and double rooms with a big yard for parking.',
   5800::numeric, 'Nyaribo', 'nyaribo', 'Nyaribo junction, near the stage',
   'Matatu to campus every 10 minutes', -0.3710, 36.9720,
   '{security,parking,water-24h}', true, false, false, false, 'grace-njeri'),
  ('Embassy Area Studios', 'embassy-area-studios', 'Self-contained studios with modern finishes and reliable internet.',
   10500::numeric, 'Embassy Area', 'embassy-area', 'Embassy Area, second left after the roundabout',
   '5 minutes to campus', -0.3885, 36.9670,
   '{wifi,security,hot-shower,parking}', true, true, true, true, 'mary-wanjiru'),
  ('Kahawa Ridge Hostel', 'kahawa-ridge-hostel', 'Affordable shared rooms with cleaned communal bathrooms.',
   4200::numeric, 'Kahawa Ridge', 'kahawa-ridge', 'Kahawa Ridge, near the water tank',
   '8 minutes to campus', -0.3800, 36.9550,
   '{water-24h,security}', true, false, false, false, 'peter-kamau'),
  ('Gate B Bedsitter', 'gate-b-bedsitter', 'Furnished bedsitter right next to the Gate B shops.',
   7000::numeric, 'Near Gate B', 'near-gate-b', 'Gate B, first building on the right',
   '1 minute to Gate B', -0.3960, 36.9690,
   '{wifi,security,cctv,study-room}', true, true, true, false, 'grace-njeri')
) AS v(title, slug, description, price, location, area, specific_location, proximity, lat, lng,
       amenities, water, electricity, wifi, hotwater, agent_slug);

INSERT INTO listing_room_types (listing_id, category, room_type, price, is_available)
SELECT l.id, 'hostel', v.room_type, v.price, true
FROM (VALUES
  ('sunrise-hostel', 'Single Room', 6500),
  ('sunrise-hostel', 'Double Room', 9000),
  ('green-view-apartments', 'Bedsitter', 8200),
  ('green-view-apartments', '1 Bedroom', 13000),
  ('nyaribo-comfort', 'Single Room', 5800),
  ('embassy-area-studios', 'Studio', 10500),
  ('kahawa-ridge-hostel', 'Shared Room', 4200),
  ('gate-b-bedsitter', 'Bedsitter', 7000)
) AS v(slug, room_type, price)
JOIN listings l ON l.slug = v.slug;

-- Promote legacy rows into the new model (properties + units + lister orgs).
SELECT project_listing(id) FROM listings
 WHERE agent_id IN (SELECT id FROM agents WHERE phone LIKE '+2547120000%' OR phone LIKE '+2547120001%');

COMMIT;
