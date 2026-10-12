import { cache } from 'react';
import { rumiaServer } from '@/lib/api/rumia';

export interface LiveMarket {
  slug: string;
  name: string;
}

/** The markets that are open to the public (live or pilot), from the API. Empty if the API is unreachable. */
export const getLiveMarkets = cache(async (): Promise<LiveMarket[]> => {
  const res = await rumiaServer({ revalidate: 3600 }).GET('/api/v1/markets').catch(() => null);
  return (res?.data ?? []).map((m) => ({ slug: m.slug, name: m.name }));
});

/** "Nyeri", "Nyeri and Kisii", "Nyeri, Kisii and Nakuru". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "kisii" -> "Kisii". For a listing's county when only its slug is at hand. */
export function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
