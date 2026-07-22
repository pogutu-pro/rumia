/**
 * Tour Booking Pricing Matrix
 *
 * Price is determined by zone (from listing.area) and tour type.
 * All amounts are in KSh.
 *
 * To update prices: edit the PRICING_MATRIX below.
 * No other file should contain hardcoded tour prices.
 */

import type { TourType } from '@/types';

interface ZonePricing {
  specific_hostel: number;
  full_search: number;
}

/**
 * Maps listing.area values to their tour pricing tiers.
 * Keep this in sync with AREA_OPTIONS in dekut-areas.ts.
 */
export const PRICING_MATRIX: Record<string, ZonePricing> = {
  Boma: { specific_hostel: 300, full_search: 600 },
  'Nyeri View': { specific_hostel: 500, full_search: 1000 },
  'Kahawa Ridge': { specific_hostel: 500, full_search: 1000 },
  Nyaribo: { specific_hostel: 800, full_search: 1500 },
  'Embassy Area': { specific_hostel: 800, full_search: 1500 },
  // Near Gate A & Near Gate B: mapped to Boma tier (cheapest) as default.
  // Update these if a different tier is intended.
  'Near Gate A': { specific_hostel: 300, full_search: 600 },
  'Near Gate B': { specific_hostel: 300, full_search: 600 },
};

/**
 * Returns the tour price for a given zone and tour type.
 * Returns null if the zone is not in the pricing matrix.
 */
export function getTourPrice(
  zone: string | null | undefined,
  tourType: TourType,
): number | null {
  if (!zone) return null;
  const tier = PRICING_MATRIX[zone];
  if (!tier) return null;
  return tier[tourType];
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
