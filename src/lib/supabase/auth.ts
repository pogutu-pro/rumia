import { createClient } from './client';
import { GOOGLE_AUTH_ENABLED, openGoogleAuthModal } from '@/lib/google-auth';

export async function signInWithGoogle(next?: string) {
  if (!GOOGLE_AUTH_ENABLED) {
    openGoogleAuthModal();
    return { data: null, error: new Error('Google Sign-In is temporarily unavailable') };
  }

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
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}
