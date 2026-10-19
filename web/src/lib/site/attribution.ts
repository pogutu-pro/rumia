/**
 * First-touch attribution for RumiaBnB: the campaign link a guest first arrived from (UTM parameters and landing
 * page), kept in this browser for 60 days and sent with every contact and booking request. This is how a stay is
 * traced back to the TikTok, YouTube or Instagram post that produced it.
 *
 * A later visit with new UTM parameters replaces it only once it has expired, so a guest who saw a TikTok and later
 * came back by typing the address is still credited to the TikTok.
 */
import type { Attribution } from './bnb-api';

const KEY = 'rumiabnb_attr';
const TTL_MS = 60 * 24 * 60 * 60 * 1000;
const FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

interface Stored extends Attribution {
  at: number;
}

function clip(v: string | null, n = 100): string | null {
  const s = (v ?? '').trim();
  return s ? s.slice(0, n) : null;
}

/** UTM parameters in a query string, or null when there are none. */
export function utmFrom(search: string): Attribution | null {
  const params = new URLSearchParams(search);
  const found: Attribution = {};
  let any = false;
  for (const f of FIELDS) {
    const v = clip(params.get(f));
    if (v) {
      found[f] = v.toLowerCase();
      any = true;
    }
  }
  return any ? found : null;
}

function read(now = Date.now()): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    return v && typeof v.at === 'number' && now - v.at < TTL_MS ? v : null;
  } catch {
    return null;
  }
}

/** Call on every page load: stores the first campaign (or the first landing page) of this browser. */
export function captureAttribution(location: { search: string; pathname: string }, now = Date.now()): void {
  if (typeof window === 'undefined') return;
  const current = read(now);
  const utm = utmFrom(location.search);
  if (current && (current.utm_source || !utm)) return;
  const next: Stored = { ...(utm ?? {}), landing_path: clip(location.pathname, 300), at: now };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the contact still goes through, just without a source
  }
}

/** The stored attribution plus the guest's own answer, ready to send. */
export function attributionFor(heardFrom?: string | null, now = Date.now()): Attribution {
  const stored = typeof window === 'undefined' ? null : read(now);
  const out: Attribution = {};
  if (stored) {
    for (const f of FIELDS) if (stored[f]) out[f] = stored[f];
    if (stored.landing_path) out.landing_path = stored.landing_path;
  }
  if (heardFrom) out.heard_from = heardFrom.slice(0, 60);
  return out;
}
