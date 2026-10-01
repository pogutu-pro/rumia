-- Minimal stand-ins for the Supabase-provided objects the migrations reference.
-- Lets supabase/migrations/*.sql replay on plain Postgres. Remove the auth
-- parts once custom auth owns the users table (migration step 3).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE,
  phone               text,
  raw_user_meta_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at     timestamptz
);

-- RLS helpers read request.jwt.claims; FastAPI connects as one role, so these
-- return NULL unless a claim is set for the session.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT NULLIF(auth.jwt() ->> 'role', '') $$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT NULLIF(auth.jwt() ->> 'email', '') $$;

GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
