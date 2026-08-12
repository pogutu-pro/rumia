'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import type { ListingViewCounts } from '@/lib/listing-views';

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

function formatListingViewLine(counts: ListingViewCounts) {
  return [
    `${counts.today.toLocaleString()} views today`,
    `${counts.week.toLocaleString()} this week`,
    `${counts.month.toLocaleString()} this month`,
    `${counts.allTime.toLocaleString()} since listed`,
  ].join(' · ');
}

function useListingViewCounts(listingId: string) {
  const [counts, setCounts] = useState<ListingViewCounts>(EMPTY_COUNTS);

  useEffect(() => {
    if (!listingId) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    const url = new URL(`${supabaseUrl}/rest/v1/rpc/get_listing_view_counts`);
    url.searchParams.set('p_listing_id', listingId);

    fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (!rows) return;
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) return;
        setCounts({
          today: toCount(row.today_count),
          week: toCount(row.week_count),
          month: toCount(row.month_count),
          allTime: toCount(row.all_time_count),
        });
      })
      .catch(() => {});
  }, [listingId]);

  return counts;
}

interface ListingViewCountsAllTimeProps {
  listingId: string;
  className?: string;
  iconSize?: number;
}

export function ListingViewCountsAllTime({
  listingId,
  className,
  iconSize = 4,
}: ListingViewCountsAllTimeProps) {
  const counts = useListingViewCounts(listingId);
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Eye className={`h-${iconSize} w-${iconSize}`} />
      {counts.allTime.toLocaleString()}
    </span>
  );
}

interface ListingViewCountsLineProps {
  listingId: string;
}

export function ListingViewCountsLine({ listingId }: ListingViewCountsLineProps) {
  const counts = useListingViewCounts(listingId);
  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
      <Eye className="h-4 w-4" />
      {formatListingViewLine(counts)}
    </p>
  );
}
