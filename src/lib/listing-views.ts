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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !listingId) {
    return EMPTY_COUNTS;
  }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/rpc/get_listing_view_counts`);
    url.searchParams.set('p_listing_id', listingId);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return EMPTY_COUNTS;
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;

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
