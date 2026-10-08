import { API_BASE_URL } from '@/lib/api/config';
import { deviceHeaders } from '@/lib/device';
import { detectInAppBrowser } from '@/lib/auth/in-app-browser';

/** Event names accepted by the API (kept in step with backend/app/features/events/schemas.py). */
export type EventName =
  | 'session_started'
  | 'intent_set'
  | 'search_performed'
  | 'results_impression'
  | 'property_opened'
  | 'media_engaged'
  | 'property_dwell'
  | 'save_toggled'
  | 'share_clicked'
  | 'contact_followup_answered'
  | 'directions_opened'
  | 'not_interested'
  | 'alert_created'
  | 'alert_opened'
  | 'outcome_reported';

export type Surface = 'home' | 'explore' | 'property' | 'saved' | 'watch' | 'share_landing' | 'place' | 'check' | 'other';
export type ReferrerKind = 'whatsapp' | 'instagram' | 'tiktok' | 'facebook' | 'google' | 'direct' | 'internal' | 'other';

interface QueuedEvent {
  event_id: string;
  name: EventName;
  occurred_at: string;
  surface?: Surface;
  referrer_kind?: ReferrerKind;
  market?: string;
  listing_id?: string;
  props: Record<string, unknown>;
}

const MAX_BATCH = 50;
const FLUSH_MS = 4000;
const SESSION_KEY = 'rumia_sid';

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sessionId(): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid().slice(0, 18);
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'nosession';
  }
}

/** Where this visit came from, as a coarse bucket. Never stores the full referrer URL. */
export function referrerKind(referrer: string = typeof document === 'undefined' ? '' : document.referrer, ua: string = ''): ReferrerKind {
  const r = referrer.toLowerCase();
  const u = ua.toLowerCase();
  if (r.includes('whatsapp') || u.includes('whatsapp')) return 'whatsapp';
  if (r.includes('instagram') || u.includes('instagram')) return 'instagram';
  if (r.includes('tiktok') || u.includes('musical_ly') || u.includes('tiktok')) return 'tiktok';
  if (r.includes('facebook') || r.includes('fb.com') || u.includes('fban') || u.includes('fbav')) return 'facebook';
  if (r.includes('google.')) return 'google';
  if (!r) return 'direct';
  try {
    if (new URL(r).host === window.location.host) return 'internal';
  } catch {
    // fall through
  }
  return 'other';
}

async function flush(useKeepalive = false): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      keepalive: useKeepalive, // lets the request finish while the page is closing
      headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
      body: JSON.stringify({ session_id: sessionId(), events: batch }),
    });
  } catch {
    // Analytics must never affect the visitor. Drop the batch rather than retry forever.
  }
  if (queue.length > 0) void flush(useKeepalive);
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const onHide = () => void flush(true);
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
}

/** Record a behaviour event. Batched; safe to call anywhere on the client. */
export function track(
  name: EventName,
  opts: { surface?: Surface; market?: string; listingId?: string; props?: Record<string, unknown> } = {},
): void {
  if (typeof window === 'undefined') return;
  ensureStarted();
  queue.push({
    event_id: uuid(),
    name,
    occurred_at: new Date().toISOString(),
    surface: opts.surface,
    market: opts.market,
    listing_id: opts.listingId,
    props: opts.props ?? {},
  });
  if (queue.length >= MAX_BATCH) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

/** Once per browser session: where the visit started and whether it is an in-app browser. */
export function trackSessionStart(surface: Surface, market?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem('rumia_ss')) return;
    window.sessionStorage.setItem('rumia_ss', '1');
  } catch {
    // proceed; at worst the event repeats
  }
  const ua = navigator.userAgent;
  const inApp = detectInAppBrowser(ua);
  ensureStarted();
  queue.push({
    event_id: uuid(),
    name: 'session_started',
    occurred_at: new Date().toISOString(),
    surface,
    referrer_kind: referrerKind(document.referrer, ua),
    market,
    props: { entry_path: window.location.pathname, in_app_browser: inApp.isInApp, app: inApp.app, platform: inApp.platform },
  });
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

/** Test helper. */
export function _resetEventsForTests() {
  queue = [];
  timer = null;
  started = false;
}
export function _queued() {
  return queue;
}
