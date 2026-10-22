/**
 * First-time setup ("/welcome") rules, shared by the sign-in redirect, the welcome page and the account page so
 * they never disagree about who still has something to fill in.
 */
export const WELCOME_PATH = '/welcome';

/** Set when someone taps "Skip for now": sign-in stops sending them to /welcome for a while. Readable by JS. */
export const SETUP_LATER_COOKIE = 'rumia_setup_later';
export const SETUP_LATER_SECONDS = 14 * 24 * 60 * 60;

const STAFF_ROLES = new Set(['agent', 'admin', 'manager', 'super_admin']);

export interface SetupProfile {
  role?: string | null;
  full_name?: string | null;
  phone?: string | null;
  home_campus_confirmed_at?: string | null;
}

export interface MissingSetup {
  name: boolean;
  phone: boolean;
  campus: boolean;
  /** Mirrors the API's `needs_profile_completion`: a student without a phone or a confirmed campus. */
  required: boolean;
}

export function missingSetup(profile: SetupProfile): MissingSetup {
  const staff = STAFF_ROLES.has(profile.role ?? '');
  const phone = !staff && !profile.phone?.trim();
  const campus = !staff && !profile.home_campus_confirmed_at;
  return { name: !staff && !profile.full_name?.trim(), phone, campus, required: phone || campus };
}

/** Where sign-in lands: the welcome step first when setup is due and was not postponed, else `next` itself. */
export function afterSignIn(next: string, needsSetup: boolean, postponed: boolean): string {
  if (!needsSetup || postponed) return next;
  return `${WELCOME_PATH}?next=${encodeURIComponent(next)}`;
}
