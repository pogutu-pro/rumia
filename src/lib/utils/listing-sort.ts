/**
 * Sorts listings with admin-positioned items first (ascending by sort_position),
 * then unpositioned items by created_at DESC (existing organic order).
 * Used consistently across all public-facing listing pages.
 */
export function sortListingsByPosition<T extends { sort_position?: number | null; created_at?: string }>(
  listings: T[]
): T[] {
  return [...listings].sort((a, b) => {
    const aPos = a.sort_position ?? null;
    const bPos = b.sort_position ?? null;
    if (aPos !== null && bPos !== null) return aPos - bPos;
    if (aPos !== null) return -1;
    if (bPos !== null) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}
