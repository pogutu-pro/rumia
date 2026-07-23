/**
 * Tour Booking Pricing Matrix
 *
 * Pricing rules:
 *   - From listing details page → specific_hostel = KSh 100 flat
 *   - From /book-tour page → specific_hostel = KSh 300 flat (pick up to 4 hostels)
 *   - Full search → varies by zone (see matrix below)
 *
 * All amounts are in KSh.
 */

import type { TourType } from '@/types';

interface ZonePricing {
  full_search: number;
}

/**
 * Maps listing.area values to their full-search tour pricing tiers.
 * specific_hostel pricing is flat (100 from details, 300 from /book-tour).
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

/** Flat price for booking a tour from a specific listing details page */
export const LISTING_SPECIFIC_PRICE = 100;

/** Flat price for booking a specific-hostel tour from /book-tour (zone picker) */
export const ZONE_SPECIFIC_PRICE = 300;

/**
 * Returns the tour price for a given zone and tour type.
 * If fromListing is true, uses the flat listing-specific price.
 * Returns null if zone is unknown and it's a full_search.
 */
export function getTourPrice(
  zone: string | null | undefined,
  tourType: TourType,
  fromListing: boolean = false,
): number | null {
  if (tourType === 'specific_hostel') {
    return fromListing ? LISTING_SPECIFIC_PRICE : ZONE_SPECIFIC_PRICE;
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
