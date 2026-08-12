'use client';

export interface RecentlyViewedHostel {
  id: string;
  title: string;
  price: number;
  location: string;
  slug: string;
  county?: string | null;
  area?: string | null;
  imageUrl?: string | null;
  viewedAt: number;
}

const STORAGE_KEY = 'rumia_recently_viewed_hostels';
const MAX_ITEMS = 10;

export function getRecentlyViewedHostels(): RecentlyViewedHostel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as RecentlyViewedHostel[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewedHostel(item: Omit<RecentlyViewedHostel, 'viewedAt'>): void {
  if (typeof window === 'undefined' || !item.id) return;
  try {
    const existing = getRecentlyViewedHostels();
    const filtered = existing.filter((h) => h.id !== item.id);
    const updated: RecentlyViewedHostel[] = [
      {
        ...item,
        viewedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Fail gracefully if localStorage is unavailable
  }
}

export function clearRecentlyViewedHostels(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail gracefully
  }
}
