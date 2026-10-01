/**
 * Shared session primitives for our own auth (replaces Supabase Auth cookies).
 *
 *   rumia_at  access JWT, readable by JS (short-lived; sent as Bearer to the API)
 *   rumia_rt  refresh token, httpOnly (only ever sent to our own /auth/* routes)
 *   rumia_s   "a session exists" hint (readable by JS, lives as long as the refresh token)
 *
 * Authorization is always enforced by the API; claims decoded here are for UX only.
 */
export const AT_COOKIE = 'rumia_at';
export const RT_COOKIE = 'rumia_rt';
export const HINT_COOKIE = 'rumia_s';
export const STATE_COOKIE = 'rumia_oauth_state';
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Refresh when fewer than this many seconds of access-token life remain. */
export const REFRESH_SKEW_SECONDS = 60;

export interface AuthUser {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string | null; avatar_url?: string | null };
}

export interface AuthSession {
  access_token: string;
  expires_at: number; // epoch seconds
  user: AuthUser;
}

export interface BackendSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  next?: string | null;
  app_redirect?: string | null;
  otc?: string | null;
}

function base64UrlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    return decodeURIComponent(
      Array.from(bin, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

/** Decode (NOT verify) an access token into a session object; null if malformed. */
export function sessionFromToken(token: string | undefined | null): AuthSession | null {
  if (!token) return null;
  try {
    const claims = JSON.parse(base64UrlDecode(token.split('.')[1]));
    if (!claims.sub || !claims.exp) return null;
    return {
      access_token: token,
      expires_at: claims.exp,
      user: {
        id: claims.sub,
        email: claims.email ?? null,
        user_metadata: claims.user_metadata ?? {},
      },
    };
  } catch {
    return null;
  }
}

export function isFresh(session: AuthSession | null, skew = REFRESH_SKEW_SECONDS): session is AuthSession {
  return !!session && session.expires_at - Math.floor(Date.now() / 1000) > skew;
}

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Cookie attribute sets for response.cookies.set(). */
export function sessionCookies(s: BackendSession) {
  const base = { path: '/', sameSite: 'lax' as const, secure: cookieSecure() };
  return [
    { name: AT_COOKIE, value: s.access_token, options: { ...base, httpOnly: false, maxAge: s.expires_in } },
    { name: RT_COOKIE, value: s.refresh_token, options: { ...base, httpOnly: true, maxAge: REFRESH_TTL_SECONDS } },
    { name: HINT_COOKIE, value: '1', options: { ...base, httpOnly: false, maxAge: REFRESH_TTL_SECONDS } },
  ];
}

export const CLEAR_COOKIES = [AT_COOKIE, RT_COOKIE, HINT_COOKIE];
