import { listingPath } from '@/lib/utils/listing-path';
import type { SearchCard } from '@/lib/api/rumia';

/** Where a card from the discovery API lives in the existing site. Short stays have their own pages. */
export function cardHref(card: Pick<SearchCard, 'kind' | 'slug' | 'listing_id'>): string {
  if ((card.kind === 'house' || card.kind === 'room') && card.listing_id) return `/bnb/${card.listing_id}`;
  return listingPath({ slug: card.slug });
}
