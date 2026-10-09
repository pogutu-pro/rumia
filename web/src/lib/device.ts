/**
 * An anonymous device id: a random UUID kept in the browser. It lets Rumia remember saves, searches and
 * contacts without an account, and is linked to the account on sign-in. It identifies a browser, not a person.
 */
const KEY = 'rumia_did';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for old webviews: RFC 4122 v4 from getRandomValues / Math.random.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/** The device id, created on first use. Returns null on the server. */
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(KEY);
  } catch {
    // storage blocked: fall through to the cookie
  }
  if (!id || !UUID_RE.test(id)) id = readCookie();
  if (!id || !UUID_RE.test(id)) id = randomUuid();
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
  try {
    // First-party cookie as a backup (some in-app browsers drop localStorage between sessions).
    document.cookie = `${KEY}=${encodeURIComponent(id)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
  return id;
}

export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  return id ? { 'X-Device-Id': id } : {};
}
