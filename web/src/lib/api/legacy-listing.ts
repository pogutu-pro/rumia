/**
 * The search/hostel components were written against the old PostgREST shape
 * (`listing_images`, `listing_room_types`, `agents`). FastAPI returns `images`,
 * `room_types`, `agent`. Convert at the boundary so the components stay unchanged.
 */
export function toLegacyListingShape<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    listing_images: item.images ?? [],
    listing_room_types: item.room_types ?? [],
    agents: item.agent ?? null,
  };
}
