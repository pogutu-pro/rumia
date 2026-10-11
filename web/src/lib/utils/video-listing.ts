import { listingPath } from '@/lib/utils/listing-path';
import { formatAreaName } from '@/lib/utils/area-label';
import type { Listing } from '@/types';

/** Canonical page for a listing (same rule the home cards use). */
export function listingHref(listing: Listing): string {
  if (listing.slug) return listingPath(listing);
  if (listing.property_type === 'short_stay') return `/bnb/${listing.id}`;
  return `/listing/${listing.id}`;
}

export function categoryLabel(listing: Listing): string {
  if (listing.property_type === 'apartment') return 'Apartment';
  if (listing.property_type === 'short_stay') return 'Short stay';
  return 'Hostel';
}

export function placeLabel(listing: Listing): string {
  return formatAreaName(listing.area) || listing.location || '';
}

export function pricePeriodLabel(listing: Listing): string {
  return listing.property_type === 'short_stay' ? 'night' : 'month';
}
