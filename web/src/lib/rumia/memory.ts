/**
 * What Rumia remembers about this browser, without an account: the last search and recently viewed places.
 * Stored only on the device; clearable from the home screen. Every read tolerates storage being blocked.
 */
const LAST_KEY = 'rumia_last_search';
const VIEWED_KEY = 'rumia_recent';
const MAX_VIEWED = 20;

export interface LastSearch {
  href: string;
  label: string;
  at: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: memory is a nicety
  }
}

export function rememberSearch(entry: LastSearch): void {
  write(LAST_KEY, entry);
}
export function lastSearch(): LastSearch | null {
  return read<LastSearch>(LAST_KEY);
}
export function rememberViewed(listingId: string): void {
  const list = (read<string[]>(VIEWED_KEY) ?? []).filter((id) => id !== listingId);
  list.unshift(listingId);
  write(VIEWED_KEY, list.slice(0, MAX_VIEWED));
}
export function recentlyViewed(limit = 6): string[] {
  return (read<string[]>(VIEWED_KEY) ?? []).slice(0, limit);
}
export function forgetEverything(): void {
  try {
    window.localStorage.removeItem(LAST_KEY);
    window.localStorage.removeItem(VIEWED_KEY);
  } catch {
    // ignore
  }
}
