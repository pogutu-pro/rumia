-- Refresh tokens for our own authentication (replaces Supabase Auth sessions).
-- Only SHA-256 hashes are stored. kind='otc' rows are short-lived one-time codes used to hand a
-- login from the web redirect back to the mobile app.
CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  family_id   uuid NOT NULL,
  kind        text NOT NULL DEFAULT 'refresh' CHECK (kind IN ('refresh', 'otc')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_refresh_tokens_user_idx ON public.auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS auth_refresh_tokens_family_idx ON public.auth_refresh_tokens (family_id);
ALTER TABLE public.auth_refresh_tokens ENABLE ROW LEVEL SECURITY;
