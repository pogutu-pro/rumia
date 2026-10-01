import { createClient, getBrowserSession, hasStoredSession } from './client';

/** Start the Google sign-in (full-page redirect through our /auth/google/start route). */
export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    options: { redirectTo: next ? `${window.location.origin}/?next=${encodeURIComponent(next)}` : undefined },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await createClient().auth.signOut();
  return { error };
}

export async function getSession() {
  return { session: await getBrowserSession(), error: null as Error | null };
}

/** Cheap check (no network): is there a signed-in session on this browser? */
export function hasStoredSessionCookie(): boolean {
  return hasStoredSession();
}
