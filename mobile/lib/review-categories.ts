// Mirrors web/src/lib/review-categories.ts — the mobile client uses the same
// 8 category keys, labels, and equal-weight overall rating formula so ratings
// are consistent across platforms. Keys map 1:1 to nullable `rating_<key>`
// columns on the `reviews` table.

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

export function roundedToStars(overall: number | null): number {
  if (overall == null || Number.isNaN(overall)) return 0;
  return Math.min(5, Math.max(0, Math.round(overall)));
}

export function formatOverall(overall: number | null): string {
  if (overall == null || Number.isNaN(overall)) return '—';
  return (Math.round(overall * 10) / 10).toFixed(1);
}

/** Extract a CategoryRatings map from a review row's rating_* fields. */
export function categoryRatingsFromRow(row: Record<string, unknown>): CategoryRatings {
  const result: CategoryRatings = {};
  for (const category of REVIEW_CATEGORIES) {
    const value = row[columnForCategory(category.key)] as unknown;
    if (typeof value === 'number' && value >= 1 && value <= 5) {
      result[category.key] = value;
    }
  }
  return result;
}

/** Flat payload keyed by `rating_<key>` for the POST /reviews body. */
export function categoryColumnsFromCategories(
  categories: CategoryRatings,
): Partial<Record<`rating_${string}`, number>> {
  const result: Partial<Record<`rating_${string}`, number>> = {};
  for (const [key, value] of Object.entries(categories) as [ReviewCategoryKey, number][]) {
    result[columnForCategory(key)] = value;
  }
  return result;
}