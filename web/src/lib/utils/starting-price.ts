export interface PricedRoomType {
  price?: number | null;
  deposit?: number | null;
  is_available?: boolean | null;
  occupancy?: string | number | null;
  category?: string | null;
  room_type?: string | null;
}

export interface PricedListing {
  price?: number | null;
  price_single?: number | null;
  price_sharing?: number | null;
}

/**
 * The room type whose rent is shown as "from" price: the cheapest shared-occupancy
 * available room type, else the cheapest available room type, else null.
 */
export function pickBestRoomType<T extends PricedRoomType>(roomTypes: T[] | null | undefined): T | null {
  const available = (roomTypes ?? []).filter((rt) => rt.is_available !== false && rt.price != null);
  if (available.length === 0) return null;
  const shared = available.filter(
    (rt) =>
      Number(rt.occupancy) > 1 ||
      rt.category === 'shared' ||
      rt.room_type?.toLowerCase().includes('sharing') ||
      rt.room_type?.toLowerCase().includes('shared'),
  );
  const pool = shared.length > 0 ? shared : available;
  return pool.reduce((best, rt) => (best == null || (rt.price as number) < (best.price as number) ? rt : best), null as T | null);
}

/** Single source of truth for the "from" price shown on cards and on the property page. */
export function getStartingPrice(listing: PricedListing, roomTypes?: PricedRoomType[] | null): number {
  const best = pickBestRoomType(roomTypes);
  return best?.price ?? listing.price_sharing ?? listing.price_single ?? listing.price ?? 0;
}
