/**
 * On-device memory of what someone has been looking for, used to reorder results and offer shortcuts.
 * Nothing leaves the browser: no account, no server profile. Clearing site data resets it.
 */
const KEY = 'rumia_taste_v1';
const MAX_SEARCHES = 6;
const DECAY = 0.85; // older interest counts for less, so the order follows what they want now

export interface Taste {
  searches: string[];
  kinds: Record<string, number>;
  places: Record<string, number>;
  /** Midpoint of the prices they look at, with how many data points back it. */
  price: { mean: number; n: number } | null;
}

const empty = (): Taste => ({ searches: [], kinds: {}, places: {}, price: null });

export function readTaste(store: Storage | null = safeStorage()): Taste {
  if (!store) return empty();
  try {
    const raw = JSON.parse(store.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return empty();
    return {
      searches: Array.isArray(raw.searches) ? raw.searches.filter((s: unknown) => typeof s === 'string').slice(0, MAX_SEARCHES) : [],
      kinds: obj(raw.kinds),
      places: obj(raw.places),
      price: raw.price && Number.isFinite(raw.price.mean) && Number.isFinite(raw.price.n) ? { mean: raw.price.mean, n: raw.price.n } : null,
    };
  } catch {
    return empty();
  }
}

function obj(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number>;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function write(t: Taste, store: Storage | null) {
  try {
    store?.setItem(KEY, JSON.stringify(t));
  } catch {
    // storage full or blocked: personalisation is a nicety
  }
}

function bump(map: Record<string, number>, key: string | null | undefined, by = 1): Record<string, number> {
  const next = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v * DECAY]).filter(([, v]) => (v as number) > 0.05));
  if (key) next[key] = (next[key] ?? 0) + by;
  return next;
}

export function rememberSearch(query: string, store: Storage | null = safeStorage()): void {
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < 2) return;
  const t = readTaste(store);
  t.searches = [q, ...t.searches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX_SEARCHES);
  write(t, store);
}

export function forgetSearches(store: Storage | null = safeStorage()): void {
  const t = readTaste(store);
  t.searches = [];
  write(t, store);
}

export interface Seen {
  kind?: string | null;
  place?: string | null;
  price?: number | null;
}

/** Call when someone opens a place or runs a filtered search: it nudges what they are shown next. */
export function rememberInterest(seen: Seen, store: Storage | null = safeStorage()): void {
  const t = readTaste(store);
  t.kinds = bump(t.kinds, seen.kind);
  t.places = bump(t.places, seen.place);
  if (typeof seen.price === 'number' && seen.price > 0) {
    const n = Math.min((t.price?.n ?? 0) + 1, 12);
    const mean = t.price ? t.price.mean + (seen.price - t.price.mean) / n : seen.price;
    t.price = { mean, n };
  }
  write(t, store);
}

export interface Rankable {
  kind?: string | null;
  place_name?: string | null;
  from_price?: number | null;
}

/** How well a place fits what this person has been looking at, 0 when nothing is known. */
export function affinity(item: Rankable, taste: Taste): number {
  let score = 0;
  const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0) || 1;
  if (item.kind && taste.kinds[item.kind]) score += taste.kinds[item.kind] / total(taste.kinds);
  if (item.place_name && taste.places[item.place_name]) score += taste.places[item.place_name] / total(taste.places);
  if (taste.price && taste.price.n >= 2 && item.from_price) {
    const gap = Math.abs(item.from_price - taste.price.mean) / taste.price.mean;
    score += Math.max(0, 1 - gap * 2) * 0.5;
  }
  return score;
}

/**
 * Reorder a list so places that fit the person move up, without throwing away the original order:
 * the position the server chose still counts, so a strong server ranking is not buried by a weak guess.
 */
export function personalise<T extends Rankable>(items: T[], taste: Taste): T[] {
  const known = Object.keys(taste.kinds).length + Object.keys(taste.places).length + (taste.price ? 1 : 0);
  if (known === 0 || items.length < 2) return items;
  return items
    .map((item, i) => ({ item, i, score: affinity(item, taste) - i * 0.02 }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}
