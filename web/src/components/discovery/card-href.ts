import type { SearchCard } from '@/lib/api/rumia';

/** Where a card from the discovery API lives. The API gives the exact path; without one the short link resolves it. */
export function cardHref(card: Pick<SearchCard, 'slug' | 'path'>): string {
  return card.path || `/p/${card.slug}`;
}
