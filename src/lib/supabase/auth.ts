import { createClient } from './client';
import { toast } from 'sonner';

export async function signInWithGoogle(next?: string) {
  toast.error('Site is under maintenance. Please try again later.');
  return { data: null, error: new Error('Site is under maintenance') };
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
