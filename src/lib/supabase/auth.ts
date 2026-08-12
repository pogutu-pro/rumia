import { createClient } from './client';

export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  const baseUrl = `${window.location.origin}/auth/callback`;
  const redirectTo = next
    ? `${baseUrl}?next=${encodeURIComponent(next)}`
    : baseUrl;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
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
