import { fetchPublicApi } from './api/config';

export interface ListingViewCounts {
  today: number;
  week: number;
  month: number;
  allTime: number;
}

const EMPTY_COUNTS: ListingViewCounts = {
  today: 0,
  week: 0,
  month: 0,
  allTime: 0,
};

function toCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatListingViewLine(counts: ListingViewCounts) {
  return [
    `${counts.today.toLocaleString()} views today`,
    `${counts.week.toLocaleString()} this week`,
    `${counts.month.toLocaleString()} this month`,
    `${counts.allTime.toLocaleString()} since listed`,
  ].join(' · ');
}

export async function getListingViewCounts(listingId: string): Promise<ListingViewCounts> {
  if (!listingId) return EMPTY_COUNTS;

  try {
    const row = await fetchPublicApi<Record<string, unknown> | null>(
      `/analytics/views/${listingId}`,
      { next: { revalidate: 86400 } },
    );
    if (!row) return EMPTY_COUNTS;

    return {
      today: toCount(row.today_count),
      week: toCount(row.week_count),
      month: toCount(row.month_count),
      allTime: toCount(row.all_time_count),
    };
  } catch {
    return EMPTY_COUNTS;
  }
}
