// Review category definitions — single source of truth for v1.
// Keys map 1:1 to nullable columns on `reviews` (rating_<key>). Column grants
// and the get_review_summary RPC are derived from this same set of keys.
//
// Weighting is intentionally equal for v1 (transparent, easy to understand).
// A `weight` can be added here later without redesigning the schema or RPC.

export interface ReviewCategory {
  key:
    | 'cleanliness'
    | 'security'
    | 'water'
    | 'wifi'
    | 'facilities'
    | 'location'
    | 'management'
    | 'value';
  label: string;
  shortLabel: string;
  weight: number;
  order: number;
}

export const REVIEW_CATEGORIES: ReviewCategory[] = [
  { key: 'cleanliness', label: 'Cleanliness', shortLabel: 'Cleanliness', weight: 1, order: 1 },
  { key: 'security', label: 'Security', shortLabel: 'Security', weight: 1, order: 2 },
  { key: 'water', label: 'Water Availability', shortLabel: 'Water', weight: 1, order: 3 },
  { key: 'wifi', label: 'Wi-Fi / Internet', shortLabel: 'Wi-Fi', weight: 1, order: 4 },
  { key: 'facilities', label: 'Room & Facilities', shortLabel: 'Facilities', weight: 1, order: 5 },
  { key: 'location', label: 'Location / Convenience', shortLabel: 'Location', weight: 1, order: 6 },
  { key: 'management', label: 'Caretaker / Management', shortLabel: 'Management', weight: 1, order: 7 },
  { key: 'value', label: 'Value for Money', shortLabel: 'Value', weight: 1, order: 8 },
];

export type ReviewCategoryKey = (typeof REVIEW_CATEGORIES)[number]['key'];

export type CategoryRatings = Partial<Record<ReviewCategoryKey, number>>;

export function columnForCategory(key: ReviewCategoryKey): `rating_${string}` {
  return `rating_${key}` as const;
}

export function categoryFromColumn(column: string): ReviewCategoryKey | null {
  if (!column.startsWith('rating_')) return null;
  const key = column.slice('rating_'.length);
  return REVIEW_CATEGORIES.some((c) => c.key === key) ? (key as ReviewCategoryKey) : null;
}

/**
 * Compute the overall rating from a per-category rating map.
 * - Only rated categories (1..5) contribute.
 * - Unrated categories are excluded (never treated as zero).
 * - Equal-weight average for v1; if weighting is introduced later it takes
 *   effect here without changing the schema.
 */
export function computeOverallRating(categories: CategoryRatings): number | null {
  let sum = 0;
  let totalWeight = 0;
  for (const category of REVIEW_CATEGORIES) {
    const value = categories[category.key];
    if (value == null || value < 1 || value > 5) continue;
    sum += value * category.weight;
    totalWeight += category.weight;
  }
  if (totalWeight === 0) return null;
  return Math.round((sum / totalWeight) * 10) / 10;
}

/** Rounded whole-star value used for display/aggregation buckets. */
export function roundedToStars(overall: number | null): number {
  if (overall == null || Number.isNaN(overall)) return 0;
  return Math.min(5, Math.max(0, Math.round(overall)));
}

export function formatOverall(overall: number | null): string {
  if (overall == null || Number.isNaN(overall)) return '—';
  return (Math.round(overall * 10) / 10).toFixed(1);
}

/** Extract a CategoryRatings map from a row that carries rating_* columns. */
export function categoryRatingsFromRow(
  row: Record<string, unknown>,
): CategoryRatings {
  const result: CategoryRatings = {};
  for (const category of REVIEW_CATEGORIES) {
    const value = row[columnForCategory(category.key)];
    if (typeof value === 'number' && value >= 1 && value <= 5) {
      result[category.key] = value;
    }
  }
  return result;
}

/** Flat payload keyed by category key (for server actions / DB writes). */
export function categoryColumnsFromCategories(
  categories: CategoryRatings,
): Partial<Record<`rating_${string}`, number>> {
  const result: Partial<Record<`rating_${string}`, number>> = {};
  for (const [key, value] of Object.entries(categories) as [ReviewCategoryKey, number][]) {
    result[columnForCategory(key)] = value;
  }
  return result;
}