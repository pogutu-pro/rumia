/**
 * Tour Booking Pricing Matrix
 *
 * Pricing rules:
 *   - specific_hostel tours = KSh 500 flat (regardless of listing or hostel count)
 *   - Full search → varies by zone (see matrix below)
 *
 * Billing does not depend on the number of hostels visited.
 * All amounts are in KSh.
 */

import type { TourType } from '@/types';

interface ZonePricing {
  full_search: number;
}

/**
 * Maps listing.area values to their full-search tour pricing tiers.
 * specific_hostel pricing is a flat KSh 500.
 */
export const PRICING_MATRIX: Record<string, ZonePricing> = {
  Boma: { full_search: 600 },
  'Nyeri View': { full_search: 1000 },
  'Kahawa Ridge': { full_search: 1000 },
  Nyaribo: { full_search: 1500 },
  'Embassy Area': { full_search: 1500 },
  'Near Gate A': { full_search: 600 },
  'Near Gate B': { full_search: 600 },
};

/** Flat price for a specific-hostel tour (booking from a listing details page) */
export const LISTING_SPECIFIC_PRICE = 500;

/** Flat price for a specific-hostel tour (booking from /book-tour zone picker) */
export const ZONE_SPECIFIC_PRICE = 500;

/**
 * Returns the tour price for a given zone and tour type.
 * specific_hostel tours are a flat KSh 500 regardless of hostel count.
 * Returns null if zone is unknown and it's a full_search.
 */
export function getTourPrice(
  zone: string | null | undefined,
  tourType: TourType,
  _fromListing: boolean = false,
): number | null {
  if (tourType === 'specific_hostel') {
    return LISTING_SPECIFIC_PRICE;
  }

  // full_search — varies by zone
  if (!zone) return null;
  const tier = PRICING_MATRIX[zone];
  if (!tier) return null;
  return tier.full_search;
}

/**
 * Returns all zone names that have pricing configured.
 */
export function getPricedZoneNames(): string[] {
  return Object.keys(PRICING_MATRIX);
}

/**
 * Formats a price in KSh for display.
 */
export function formatTourPrice(price: number): string {
  return `KSh ${price.toLocaleString()}`;
}
