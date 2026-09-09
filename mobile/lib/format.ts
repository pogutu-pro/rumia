export function formatKES(amount: number): string {
  return `KES ${(amount ?? 0).toLocaleString()}`;
}

export function formatKESPerMonth(amount: number): string {
  return `KES ${(amount ?? 0).toLocaleString()}/mo`;
}

export function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongDate(value: string): string {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatViewCount(value: number): string {
  return (value ?? 0).toLocaleString();
}

/** Badge text for listing distance categories (mirrors web getDistanceBadgeText). */
export function distanceBadgeText(distanceCategory: string | null | undefined): string | null {
  if (!distanceCategory) return null;

  const mapping: Record<string, string> = {
    'walking-500m': 'Walking distance',
    '5-10min': '5–10 min walk',
    '1-2km': '1–2 km',
    '3km': '3 km away',
    'over-3km': 'Over 3 km',
  };

  return mapping[distanceCategory] || null;
}