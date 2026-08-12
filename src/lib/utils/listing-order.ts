/**
 * Pure helpers for the admin listing reorder UI. Kept framework-free so the
 * ordering math is trivially unit-testable.
 */

export interface OrderableItem {
  id: string;
}

export interface OrderPosition {
  id: string;
  sort_position: number;
}

/**
 * Builds 1-based sort positions for a fully ordered list, as used when saving a
 * manual drag-and-drop order. The array order is preserved; each item gets its
 * 1-based index as its new sort_position.
 */
export function buildOrderPositions(items: OrderableItem[]): OrderPosition[] {
  return items.map((item, index) => ({ id: item.id, sort_position: index + 1 }));
}

/**
 * Moves the item `targetId` by `delta` steps within the currently *visible*
 * (filtered) list, mapping the move back onto the full list.
 *
 * This keeps up/down buttons consistent with drag-and-drop: a move swaps the
 * item with its visible neighbour in `filtered`, whatever that neighbour's
 * position is in the full list.
 *
 * Returns a new array when a move happens, otherwise the input array unchanged.
 */
export function moveListingWithin<T extends OrderableItem>(
  items: T[],
  filtered: OrderableItem[],
  targetId: string,
  delta: number,
): T[] {
  const fromFiltered = filtered.findIndex((l) => l.id === targetId);
  const toFiltered = fromFiltered + delta;
  if (fromFiltered === -1 || toFiltered < 0 || toFiltered >= filtered.length) {
    return items;
  }

  const fromFull = items.findIndex((l) => l.id === targetId);
  const toFull = items.findIndex((l) => l.id === filtered[toFiltered].id);
  if (fromFull === -1 || toFull === -1) {
    return items;
  }

  if (fromFull === toFull) {
    return items;
  }

  const reordered = [...items];
  const [moved] = reordered.splice(fromFull, 1);
  reordered.splice(toFull, 0, moved);
  return reordered;
}
