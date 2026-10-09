"""Access and catalog: staff assignments, lister organisations, properties + units with a lifecycle,
media, trust evidence, reports and a job queue.

The legacy `listings` table stays the write path for now. `project_listing(uuid)` copies one listing into
the new model idempotently; it is used for the backfill below and called by the API after every listing
write, so both models agree until the public experience switches over.

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

PROJECT_FN = r"""
CREATE OR REPLACE FUNCTION project_listing(p_listing uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  l      listings%ROWTYPE;
  a      agents%ROWTYPE;
  b      bnb_details%ROWTYPE;
  v_org  uuid;
  v_prop uuid;
  v_kind text;
  v_period text;
  v_slug text;
  v_has_units boolean := false;
  rt     record;
  v_unit_kind text;
BEGIN
  SELECT * INTO l FROM listings WHERE id = p_listing;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM agents WHERE id = l.agent_id;
  SELECT * INTO b FROM bnb_details WHERE listing_id = l.id;

  -- Market and place for listings written after the geography backfill: market from the county, place
  -- from the zone, else from the area name. Written back to the listing so both models agree.
  IF l.market_id IS NULL THEN
    SELECT id INTO l.market_id FROM markets
    WHERE slug = regexp_replace(lower(coalesce(l.county, '')), '[^a-z0-9]+', '-', 'g') LIMIT 1;
  END IF;
  IF l.market_id IS NOT NULL AND l.place_id IS NULL THEN
    SELECT p.id INTO l.place_id FROM places p
    WHERE p.market_id = l.market_id
      AND ((l.zone_id IS NOT NULL AND p.legacy_zone_id = l.zone_id)
           OR p.slug = regexp_replace(regexp_replace(lower(coalesce(l.area, '')), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
    ORDER BY (p.legacy_zone_id = l.zone_id) DESC NULLS LAST LIMIT 1;
  END IF;
  UPDATE listings SET market_id = l.market_id, place_id = l.place_id
  WHERE id = l.id AND (market_id IS DISTINCT FROM l.market_id OR place_id IS DISTINCT FROM l.place_id);

  -- Lister organisation: one per legacy agent until owners claim and merge them.
  SELECT id INTO v_org FROM lister_orgs WHERE legacy_agent_id = l.agent_id;
  IF v_org IS NULL THEN
    INSERT INTO lister_orgs (name, slug, kind, status, legacy_agent_id)
    VALUES (coalesce(nullif(a.name, ''), 'Lister'),
            coalesce(nullif(regexp_replace(lower(coalesce(a.slug, a.name, 'lister')), '[^a-z0-9]+', '-', 'g'), ''), 'lister')
              || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
            'individual', 'active', l.agent_id)
    RETURNING id INTO v_org;
    IF a.user_id IS NOT NULL THEN
      INSERT INTO org_members (org_id, user_id, role) VALUES (v_org, a.user_id, 'owner') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  v_kind := CASE
    WHEN l.property_type = 'apartment' THEN 'apartment'
    WHEN l.property_type = 'short_stay' THEN CASE WHEN b.listing_type = 'entire_place' OR b.listing_id IS NULL THEN 'house' ELSE 'room' END
    ELSE 'hostel' END;
  v_period := CASE WHEN l.property_type = 'short_stay' THEN coalesce(nullif(b.price_unit, ''), 'night') ELSE 'month' END;
  IF v_period NOT IN ('night', 'week', 'month', 'semester') THEN v_period := 'month'; END IF;
  v_slug := coalesce(nullif(l.slug, ''), 'p-' || substr(replace(l.id::text, '-', ''), 1, 10));

  INSERT INTO properties (
      org_id, market_id, place_id, slug, name, kind, lat, lng, address_hint, description, amenities,
      included_utilities, house_rules, status, last_confirmed_at, published_at, audience, legacy_listing_id,
      created_at, updated_at)
  VALUES (
      v_org, l.market_id, l.place_id, v_slug, l.title, v_kind, l.latitude, l.longitude,
      nullif(concat_ws(' · ', l.specific_location, l.proximity_description), ''), l.description,
      coalesce(l.amenities, '{}'),
      array_remove(ARRAY[
        CASE WHEN l.water_included THEN 'water' END, CASE WHEN l.electricity_included THEN 'electricity' END,
        CASE WHEN l.wifi_included THEN 'wifi' END, CASE WHEN l.hot_water_included THEN 'hot_water' END,
        CASE WHEN l.cooking_gas_included THEN 'cooking_gas' END], NULL),
      coalesce(b.house_rules, '{}'::jsonb),
      CASE WHEN l.is_active THEN 'live' ELSE 'paused' END,
      CASE WHEN l.is_active THEN now() END,
      CASE WHEN l.is_active THEN coalesce(l.created_at, now()) END,
      CASE WHEN l.property_type = 'hostel' THEN ARRAY['students'] ELSE '{}'::text[] END,
      l.id, coalesce(l.created_at, now()), coalesce(l.updated_at, l.created_at, now()))
  ON CONFLICT (legacy_listing_id) DO UPDATE SET
      org_id = EXCLUDED.org_id, market_id = EXCLUDED.market_id, place_id = EXCLUDED.place_id,
      name = EXCLUDED.name, kind = EXCLUDED.kind, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
      address_hint = EXCLUDED.address_hint, description = EXCLUDED.description, amenities = EXCLUDED.amenities,
      included_utilities = EXCLUDED.included_utilities, house_rules = EXCLUDED.house_rules,
      status = CASE
        WHEN properties.status IN ('live', 'stale', 'paused')
          THEN CASE WHEN NOT l.is_active THEN 'paused'
                    WHEN properties.status = 'paused' THEN 'live'
                    ELSE properties.status END
        ELSE properties.status END,
      last_confirmed_at = CASE
        WHEN l.is_active AND properties.status = 'paused' THEN now()
        ELSE properties.last_confirmed_at END,
      updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_prop;

  -- Units: one per room type; a listing without room types gets a single unit from its own price.
  FOR rt IN SELECT * FROM listing_room_types WHERE listing_id = l.id LOOP
    v_has_units := true;
    v_unit_kind := CASE
      WHEN lower(coalesce(rt.category, '') || ' ' || rt.room_type) ~ 'sharing|shared' THEN 'shared_room'
      WHEN lower(rt.room_type) ~ 'bedsit' THEN 'bedsitter'
      WHEN lower(rt.room_type) ~ 'studio' THEN 'studio'
      WHEN lower(rt.room_type) ~ '(^|[^0-9])1 ?bed|one.?bed' THEN 'one_bed'
      WHEN lower(rt.room_type) ~ '2 ?bed|two.?bed' THEN 'two_bed'
      WHEN lower(rt.room_type) ~ '[3-9] ?bed|three.?bed|four.?bed' THEN 'three_bed_plus'
      WHEN lower(rt.room_type) ~ 'double' THEN 'double_room'
      WHEN lower(rt.room_type) ~ 'single' THEN 'single_room'
      ELSE 'other' END;
    INSERT INTO property_units (property_id, legacy_key, unit_kind, label, sharing, price_amount, price_period,
                                deposit_amount, count_total, count_available, gender_policy, furnished)
    VALUES (v_prop, rt.id::text, v_unit_kind, rt.room_type,
            CASE WHEN rt.occupancy ~ '^[0-9]+$' THEN rt.occupancy::int END,
            rt.price, v_period, rt.deposit, 1,
            CASE WHEN rt.is_available AND NOT coalesce(l.is_full, false) THEN 1 ELSE 0 END,
            CASE WHEN v_kind = 'hostel' AND lower(coalesce(l.gender, '')) IN ('women', 'female', 'ladies') THEN 'women'
                 WHEN v_kind = 'hostel' AND lower(coalesce(l.gender, '')) IN ('men', 'male', 'gents') THEN 'men'
                 ELSE 'any' END,
            CASE WHEN coalesce(array_length(rt.furnishing_items, 1), 0) > 0 THEN 'partly' ELSE 'none' END)
    ON CONFLICT (property_id, legacy_key) DO UPDATE SET
        unit_kind = EXCLUDED.unit_kind, label = EXCLUDED.label, sharing = EXCLUDED.sharing,
        price_amount = EXCLUDED.price_amount, price_period = EXCLUDED.price_period,
        deposit_amount = EXCLUDED.deposit_amount, count_available = EXCLUDED.count_available,
        gender_policy = EXCLUDED.gender_policy, furnished = EXCLUDED.furnished;
  END LOOP;

  IF NOT v_has_units THEN
    INSERT INTO property_units (property_id, legacy_key, unit_kind, label, price_amount, price_period, deposit_amount,
                                max_guests, bedrooms, bathrooms, min_stay, count_total, count_available, gender_policy)
    VALUES (v_prop, 'listing', 'other', coalesce(l.room_type, l.title),
            coalesce(nullif(l.price, 0), nullif(l.price_sharing, 0), nullif(l.price_single, 0), 1),
            v_period, b.security_deposit, b.max_guests, b.bedrooms, b.bathrooms, b.min_stay_nights, 1,
            CASE WHEN coalesce(l.is_full, false) THEN 0 ELSE 1 END, 'any')
    ON CONFLICT (property_id, legacy_key) DO UPDATE SET
        label = EXCLUDED.label, price_amount = EXCLUDED.price_amount, price_period = EXCLUDED.price_period,
        deposit_amount = EXCLUDED.deposit_amount, max_guests = EXCLUDED.max_guests, bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms, min_stay = EXCLUDED.min_stay, count_available = EXCLUDED.count_available;
    DELETE FROM property_units WHERE property_id = v_prop AND legacy_key <> 'listing';
  ELSE
    DELETE FROM property_units WHERE property_id = v_prop AND legacy_key = 'listing';
    DELETE FROM property_units WHERE property_id = v_prop AND legacy_key <> 'listing'
      AND legacy_key NOT IN (SELECT id::text FROM listing_room_types WHERE listing_id = l.id);
  END IF;

  -- Media: photos in the existing order, plus the YouTube link if any.
  DELETE FROM property_media WHERE property_id = v_prop;
  INSERT INTO media_assets (org_id, kind, source, status, url, width, height, blur_data_url, legacy_image_id)
  SELECT v_org, 'image', 'upload', 'ready', i.r2_url, i.width, i.height, i.blur_data_url, i.id
  FROM listing_images i WHERE i.listing_id = l.id
  ON CONFLICT (legacy_image_id) DO UPDATE SET url = EXCLUDED.url, width = EXCLUDED.width,
      height = EXCLUDED.height, blur_data_url = EXCLUDED.blur_data_url;
  INSERT INTO property_media (property_id, asset_id, position, room_tag, is_cover)
  SELECT v_prop, m.id, row_number() OVER (ORDER BY i.display_order, i.created_at) - 1,
         CASE lower(coalesce(i.category, ''))
           WHEN 'room' THEN 'room' WHEN 'bathroom' THEN 'bathroom' WHEN 'kitchen' THEN 'kitchen'
           WHEN 'building' THEN 'exterior' WHEN 'exterior' THEN 'exterior' ELSE 'other' END,
         row_number() OVER (ORDER BY i.display_order, i.created_at) = 1
  FROM listing_images i JOIN media_assets m ON m.legacy_image_id = i.id WHERE i.listing_id = l.id;
  IF l.youtube_id IS NOT NULL AND l.youtube_id <> '' THEN
    INSERT INTO media_assets (org_id, kind, source, status, external_id, legacy_image_id)
    VALUES (v_org, 'video', 'external_youtube', 'ready', l.youtube_id, NULL)
    ON CONFLICT (org_id, source, external_id) WHERE external_id IS NOT NULL DO NOTHING;
    INSERT INTO property_media (property_id, asset_id, position, room_tag, is_cover)
    SELECT v_prop, m.id, 1000, 'other', false FROM media_assets m
    WHERE m.source = 'external_youtube' AND m.external_id = l.youtube_id AND m.org_id = v_org
    ORDER BY m.created_at LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  -- Trust evidence carried over from the existing verification.
  IF coalesce(l.verified, false) AND l.verified_source IS NOT NULL THEN
    INSERT INTO verification_evidence (subject, subject_id, kind, status, observed_at, source)
    SELECT 'property', v_prop, 'registry_match', 'valid', coalesce(l.verified_date::timestamptz, now()), l.verified_source
    WHERE NOT EXISTS (SELECT 1 FROM verification_evidence e
                      WHERE e.subject = 'property' AND e.subject_id = v_prop AND e.kind = 'registry_match');
  END IF;

  RETURN v_prop;
END $$;
"""


def upgrade() -> None:
    # ── Access ────────────────────────────────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE auth_identities (
            user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            provider   text NOT NULL CHECK (provider IN ('google', 'phone')),
            subject    text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (provider, subject)
        )
        """
    )
    op.execute("CREATE INDEX idx_auth_identities_user ON auth_identities (user_id)")
    op.execute(
        """
        INSERT INTO auth_identities (user_id, provider, subject)
        SELECT id, 'google', raw_user_meta_data->>'provider_id' FROM auth.users
        WHERE coalesce(raw_user_meta_data->>'provider_id', '') <> '' ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        CREATE TABLE staff_assignments (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            market_id  uuid REFERENCES markets(id) ON DELETE CASCADE,
            role       text NOT NULL CHECK (role IN ('admin', 'market_lead', 'reviewer', 'scout')),
            active     boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_staff_assignment ON staff_assignments (user_id, role, coalesce(market_id, '00000000-0000-0000-0000-000000000000'))")
    op.execute(
        """
        INSERT INTO staff_assignments (user_id, market_id, role)
        SELECT p.id, NULL, 'admin' FROM profiles p WHERE p.role IN ('admin', 'super_admin')
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO staff_assignments (user_id, market_id, role)
        SELECT p.id, (SELECT id FROM markets WHERE slug = 'nyeri'), 'market_lead' FROM profiles p WHERE p.role = 'manager'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        CREATE TABLE lister_orgs (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name             text NOT NULL,
            slug             text NOT NULL UNIQUE,
            kind             text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual', 'company')),
            status           text NOT NULL DEFAULT 'active' CHECK (status IN ('provisional', 'active', 'suspended')),
            standing         text NOT NULL DEFAULT 'new' CHECK (standing IN ('new', 'good', 'watch')),
            claimed_at       timestamptz,
            sourced_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            legacy_agent_id  uuid UNIQUE REFERENCES agents(id) ON DELETE SET NULL,
            created_at       timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE org_members (
            org_id     uuid NOT NULL REFERENCES lister_orgs(id) ON DELETE CASCADE,
            user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            role       text NOT NULL CHECK (role IN ('owner', 'manager', 'agent')),
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (org_id, user_id)
        )
        """
    )

    # ── Media ─────────────────────────────────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE media_assets (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id        uuid REFERENCES lister_orgs(id) ON DELETE SET NULL,
            kind          text NOT NULL CHECK (kind IN ('image', 'video')),
            source        text NOT NULL CHECK (source IN ('upload', 'external_youtube', 'external_tiktok')),
            status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'rejected')),
            url           text,
            storage_key   text,
            external_id   text,
            variants      jsonb NOT NULL DEFAULT '{}'::jsonb,
            width         int,
            height        int,
            duration_s    int,
            blur_data_url text,
            content_hash  text,
            error         text,
            legacy_image_id uuid UNIQUE,
            created_by    uuid,
            created_at    timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_media_external ON media_assets (org_id, source, external_id) WHERE external_id IS NOT NULL")
    op.execute("CREATE INDEX idx_media_content_hash ON media_assets (content_hash) WHERE content_hash IS NOT NULL")

    # ── Catalog ───────────────────────────────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE properties (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id            uuid NOT NULL REFERENCES lister_orgs(id),
            market_id         uuid REFERENCES markets(id),
            place_id          uuid REFERENCES places(id),
            slug              text NOT NULL UNIQUE,
            name              text NOT NULL,
            kind              text NOT NULL CHECK (kind IN ('hostel', 'apartment', 'house', 'compound', 'room')),
            lat               numeric(10, 7),
            lng               numeric(10, 7),
            location_precision text NOT NULL DEFAULT 'approximate' CHECK (location_precision IN ('exact', 'approximate')),
            address_hint      text,
            description       text,
            amenities         text[] NOT NULL DEFAULT '{}',
            included_utilities text[] NOT NULL DEFAULT '{}',
            house_rules       jsonb NOT NULL DEFAULT '{}'::jsonb,
            audience          text[] NOT NULL DEFAULT '{}',
            status            text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_review', 'live', 'stale', 'paused', 'let', 'removed', 'archived')),
            last_confirmed_at timestamptz,
            published_at      timestamptz,
            quality_score     numeric(5, 2) NOT NULL DEFAULT 0,
            tier              text CHECK (tier IN ('value', 'standard', 'premium')),
            contact_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            sourced_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            legacy_listing_id uuid UNIQUE REFERENCES listings(id) ON DELETE SET NULL,
            created_at        timestamptz NOT NULL DEFAULT now(),
            updated_at        timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_properties_market_status ON properties (market_id, status, kind)")
    op.execute("CREATE INDEX idx_properties_place ON properties (place_id) WHERE status IN ('live', 'stale')")
    op.execute("CREATE INDEX idx_properties_confirmed ON properties (last_confirmed_at) WHERE status IN ('live', 'stale')")
    op.execute("CREATE INDEX idx_properties_org ON properties (org_id)")
    op.execute(
        """
        CREATE TABLE property_units (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            legacy_key      text NOT NULL DEFAULT 'new',
            unit_kind       text NOT NULL CHECK (unit_kind IN ('single_room', 'double_room', 'shared_room', 'bedsitter',
                                                  'studio', 'one_bed', 'two_bed', 'three_bed_plus', 'entire_home', 'other')),
            label           text,
            bedrooms        int,
            bathrooms       int,
            sharing         int,
            bathroom        text CHECK (bathroom IN ('ensuite', 'shared')),
            furnished       text NOT NULL DEFAULT 'none' CHECK (furnished IN ('none', 'partly', 'full')),
            size_m2         numeric(7, 2),
            price_amount    numeric NOT NULL CHECK (price_amount > 0),
            price_currency  text NOT NULL DEFAULT 'KES',
            price_period    text NOT NULL CHECK (price_period IN ('night', 'week', 'month', 'semester')),
            deposit_amount  numeric CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
            min_stay        int,
            max_guests      int,
            count_total     int NOT NULL DEFAULT 1 CHECK (count_total >= 0),
            count_available int NOT NULL DEFAULT 1 CHECK (count_available >= 0),
            gender_policy   text NOT NULL DEFAULT 'any' CHECK (gender_policy IN ('any', 'women', 'men')),
            available_from  date,
            UNIQUE (property_id, legacy_key),
            CHECK (count_available <= count_total)
        )
        """
    )
    op.execute("CREATE INDEX idx_units_property ON property_units (property_id)")
    op.execute("CREATE INDEX idx_units_price ON property_units (price_period, price_amount)")
    op.execute(
        """
        CREATE TABLE property_media (
            property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            asset_id    uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
            position    int NOT NULL DEFAULT 0,
            room_tag    text NOT NULL DEFAULT 'other'
                CHECK (room_tag IN ('exterior', 'room', 'bathroom', 'kitchen', 'common', 'view', 'other')),
            is_cover    boolean NOT NULL DEFAULT false,
            unit_id     uuid REFERENCES property_units(id) ON DELETE SET NULL,
            PRIMARY KEY (property_id, asset_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE property_status_history (
            id          bigserial PRIMARY KEY,
            property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            from_status text,
            to_status   text NOT NULL,
            actor_kind  text NOT NULL CHECK (actor_kind IN ('lister', 'staff', 'system', 'seeker')),
            actor_id    uuid,
            reason      text,
            at          timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_status_history_property ON property_status_history (property_id, at DESC)")
    op.execute(
        """
        CREATE TABLE property_landmark_distances (
            property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            landmark_id uuid NOT NULL REFERENCES landmarks(id) ON DELETE CASCADE,
            straight_m  int NOT NULL,
            walk_min    int NOT NULL,
            PRIMARY KEY (property_id, landmark_id)
        )
        """
    )

    # ── Trust and moderation ─────────────────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE verification_evidence (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            subject     text NOT NULL CHECK (subject IN ('property', 'org', 'user')),
            subject_id  uuid NOT NULL,
            kind        text NOT NULL CHECK (kind IN ('phone_otp', 'availability_confirm', 'site_visit', 'registry_match', 'ownership_doc')),
            status      text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked')),
            observed_at timestamptz NOT NULL DEFAULT now(),
            expires_at  timestamptz,
            actor_id    uuid,
            source      text,
            data        jsonb NOT NULL DEFAULT '{}'::jsonb
        )
        """
    )
    op.execute("CREATE INDEX idx_evidence_subject ON verification_evidence (subject, subject_id, kind)")
    op.execute(
        """
        CREATE TABLE reports (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            reason      text NOT NULL CHECK (reason IN ('not_available', 'wrong_price', 'scam', 'wrong_location', 'other')),
            details     text,
            device_id   uuid,
            user_id     uuid,
            status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
            priority    int NOT NULL DEFAULT 0,
            resolved_by uuid,
            resolution  text,
            created_at  timestamptz NOT NULL DEFAULT now(),
            resolved_at timestamptz
        )
        """
    )
    op.execute("CREATE INDEX idx_reports_open ON reports (status, priority DESC, created_at) WHERE status = 'open'")
    op.execute("CREATE INDEX idx_reports_property ON reports (property_id, reason)")

    # ── Jobs ──────────────────────────────────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE jobs (
            id           bigserial PRIMARY KEY,
            kind         text NOT NULL,
            payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
            run_at       timestamptz NOT NULL DEFAULT now(),
            attempts     int NOT NULL DEFAULT 0,
            max_attempts int NOT NULL DEFAULT 5,
            status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
            locked_until timestamptz,
            last_error   text,
            idempotency_key text UNIQUE,
            created_at   timestamptz NOT NULL DEFAULT now(),
            finished_at  timestamptz
        )
        """
    )
    op.execute("CREATE INDEX idx_jobs_due ON jobs (run_at) WHERE status IN ('queued', 'running')")

    # ── Projection from the legacy listing model, then backfill ──────────────────────────────────
    op.execute(PROJECT_FN)
    op.execute("SELECT project_listing(id) FROM listings")


def downgrade() -> None:
    for table in (
        "jobs", "reports", "verification_evidence", "property_landmark_distances", "property_status_history",
        "property_media", "property_units", "properties", "media_assets", "org_members", "lister_orgs",
        "staff_assignments", "auth_identities",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("DROP FUNCTION IF EXISTS project_listing(uuid)")
