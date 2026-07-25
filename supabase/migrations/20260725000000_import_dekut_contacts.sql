-- Import DEKUT hostel owner phone numbers into landlord_phone field.
-- This script matches listing titles against the DEKUT contact list using
-- normalized name matching and sets landlord_phone for high-confidence matches.
--
-- For hostels with no matching DEKUT entry, landlord_phone defaults to
-- the agent's own phone number as a temporary placeholder.
--
-- The two Sunrise hostels (New Sunrise, Sunrise Hostel) are LEFT AMBIGUOUS
-- because DeKUT lists two blocks (CD, AB) and we cannot reliably pair them
-- without human confirmation.

-- Step 1: High-confidence matches (direct name match or close variant)
UPDATE listings l
SET landlord_phone = CASE
  -- Maisha Hostels -> Maisha Hostel
  WHEN l.title ILIKE '%maisha%' AND l.title NOT ILIKE '%mimshack%' THEN '0745409929'
  -- Purple House
  WHEN l.title ILIKE '%purple house%' THEN '0141663686'
  -- Gateway Shelter
  WHEN l.title ILIKE '%gateway shelter%' THEN '0711486252'
  -- Lolan Scholars Hub / Lolan Hub Scholars
  WHEN l.title ILIKE '%lolan%' THEN '0722160189'
  -- Zion City
  WHEN l.title ILIKE '%zion city%' THEN '0702276550'
  -- Paradise
  WHEN l.title ILIKE '%paradise%' AND l.title NOT ILIKE '%paresi%' THEN '0710905822'
  -- Valley Creek
  WHEN l.title ILIKE '%valley creek%' THEN '0740671690'
  -- Urban Suites / Urban Suits
  WHEN l.title ILIKE '%urban%suit%' THEN '0718921088'
  -- Solid 4 (Gents)
  WHEN l.title ILIKE '%solid 4%' OR l.title ILIKE '%solid four%' THEN '0720490033'
  -- Paresi Hostel
  WHEN l.title ILIKE '%paresi%' THEN '0748879159'
  -- Mt Kenya / Mt. Kenya Hostel
  WHEN l.title ILIKE '%mt%kenya%' OR l.title ILIKE '%mountain%kenya%' THEN '0726969255'
  -- MimShack / Mimshack Students Residence
  WHEN l.title ILIKE '%mimshack%' OR l.title ILIKE '%mim%shack%' THEN '0724693216'
  -- Kens Hostel
  WHEN l.title ILIKE '%kens hostel%' OR l.title = 'Kens Hostel' THEN '0791863678'
  -- Delanova / DE-LA-NOVA
  WHEN l.title ILIKE '%delanova%' OR l.title ILIKE '%de-la-nova%' OR l.title ILIKE '%de la nova%' THEN '0722305973'
  -- La Duvet
  WHEN l.title ILIKE '%la duvet%' THEN '0718862632'
  -- Edge View / Edgeview Heights
  WHEN l.title ILIKE '%edge%view%' THEN '0727650200'
  -- Baraka Hostel (Boma zone, not Embassy "Baraka Hostels")
  WHEN l.title ILIKE '%baraka%' AND l.title NOT ILIKE '%hostels%' THEN '0790396326'
  -- Kimathi Student Centre
  WHEN l.title ILIKE '%kimathi%student%' OR l.title ILIKE '%kimathi%centre%' OR l.title ILIKE '%kimathi%center%' THEN '0100492929'
  -- Grace Hostels / Grace Apartment
  WHEN l.title ILIKE '%grace%hostel%' OR l.title ILIKE '%grace%apartment%' THEN '0795580924'
END
WHERE l.is_active = true
  AND l.landlord_phone IS NULL
  AND (
    l.title ILIKE '%maisha%'
    OR l.title ILIKE '%purple house%'
    OR l.title ILIKE '%gateway shelter%'
    OR l.title ILIKE '%lolan%'
    OR l.title ILIKE '%zion city%'
    OR (l.title ILIKE '%paradise%' AND l.title NOT ILIKE '%paresi%')
    OR l.title ILIKE '%valley creek%'
    OR l.title ILIKE '%urban%suit%'
    OR l.title ILIKE '%solid 4%'
    OR l.title ILIKE '%solid four%'
    OR l.title ILIKE '%paresi%'
    OR l.title ILIKE '%mt%kenya%'
    OR l.title ILIKE '%mountain%kenya%'
    OR l.title ILIKE '%mimshack%'
    OR l.title ILIKE '%mim%shack%'
    OR l.title ILIKE '%kens hostel%'
    OR l.title = 'Kens Hostel'
    OR l.title ILIKE '%delanova%'
    OR l.title ILIKE '%de-la-nova%'
    OR l.title ILIKE '%de la nova%'
    OR l.title ILIKE '%la duvet%'
    OR l.title ILIKE '%edge%view%'
    OR (l.title ILIKE '%baraka%' AND l.title NOT ILIKE '%hostels%')
    OR l.title ILIKE '%kimathi%student%'
    OR l.title ILIKE '%kimathi%centre%'
    OR l.title ILIKE '%kimathi%center%'
    OR l.title ILIKE '%grace%hostel%'
    OR l.title ILIKE '%grace%apartment%'
  );

-- Step 2: Default remaining hostels to their agent's own phone number as placeholder.
-- This ensures "Hostel Owner" always has a number to fall back to.
UPDATE listings l
SET landlord_phone = COALESCE(
  (SELECT a.whatsapp FROM agents a WHERE a.id = l.agent_id),
  (SELECT a.phone FROM agents a WHERE a.id = l.agent_id),
  '0000000000'
)
WHERE l.is_active = true
  AND l.landlord_phone IS NULL;
