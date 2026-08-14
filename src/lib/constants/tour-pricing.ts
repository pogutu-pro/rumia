/**
 * Tour Booking Pricing helpers
 *
 * Every tour is a zone tour and the price is set exclusively by a campus
 * manager in `campus_zones.full_search_price` — there are NO hardcoded
 * amounts here, so a student can never be quoted a price the manager didn't
 * configure. The source of truth is server-side (see
 * `src/lib/utils/zone-tour-price.ts`).
 *
 * All amounts are in KSh.
 */

/**
 * Formats a price in KSh for display.
 */
export function formatTourPrice(price: number): string {
  return `KSh ${price.toLocaleString()}`;
}