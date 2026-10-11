import { listingPath } from '@/lib/utils/listing-path';
import type { SearchCard } from '@/lib/api/rumia';

/** Where a card from the discovery API lives in the existing site. Short stays have their own pages. */
export function cardHref(card: Pick<SearchCard, 'kind' | 'slug' | 'place_name'>): string {
  const property_type = card.kind === 'house' || card.kind === 'room' ? 'short_stay' : card.kind === 'apartment' || card.kind === 'compound' ? 'apartment' : 'hostel';
  // The place segment is a best guess from the place name; the page redirects to the exact URL if it differs.
  return listingPath({ slug: card.slug, area: card.place_name, property_type });
}
