import { createClient } from './client';

/**
 * Canonical site origin used for OAuth redirect targets. Prefer the explicit
 * NEXT_PUBLIC_SITE_URL over the browser origin so the flow survives proxies /
 * HOST_HEADER quirks and always redirects back to the same public URL that is
 * configured in the Supabase auth allowlist.
 */
function getSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
    } catch {}
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    if (
      !origin.includes(':3000') &&
      !origin.includes('localhost') &&
      !/^[0-9a-f]{12}/i.test(window.location.hostname)
    ) {
      return origin;
    }
  }
  return 'https://rumia.co.ke';
}

export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  const baseUrl = `${getSiteOrigin()}/auth/callback`;
  const redirectTo = next
    ? `${baseUrl}?next=${encodeURIComponent(next)}`
    : baseUrl;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  return { data, error };
}

export async function signOut() {
  const supabase = createClient();
  // scope: 'local' clears the browser cookies immediately without depending
  // on a network call to revoke the token server-side. If the revoke request
  // fails (offline, timeout), `signOut({ scope: 'global' })` skips clearing
  // local state entirely, which leaves a stale session behind and breaks the
  // next Google login.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return { error };
}

export async function getSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

/**
 * Non-destructive session check used on the login page. Unlike getSession(),
 * this only inspects cookies and never triggers a token refresh or signs out
 * — a failing refresh calls `_removeSession()` internally, which would also
 * delete the PKCE code-verifier cookie and break an in-flight Google OAuth.
 */
export function hasStoredSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const cookies = document.cookie.split(';').map((c) => c.trim());
  return cookies.some((cookie) => {
    const eq = cookie.indexOf('=');
    const name = eq === -1 ? cookie : cookie.slice(0, eq);
    return /^sb-.*-auth-token(\.\d+)?$/.test(name);
  });
}
