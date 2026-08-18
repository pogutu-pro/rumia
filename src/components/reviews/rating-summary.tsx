'use client';

import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ReviewSummary } from '@/types';

interface RatingSummaryProps {
  summary: ReviewSummary;
  className?: string;
}

function formatAverage(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function RatingSummary({ summary, className }: RatingSummaryProps) {
  const { average_rating, total_reviews, distribution, categories } = summary;
  const [showAll, setShowAll] = useState(false);

  if (total_reviews === 0) {
    return null;
  }

  // Build a 5..1 ordered map so the most-stars row is on top
  const countsByRating = new Map<number, number>();
  distribution.forEach((d) => countsByRating.set(d.rating, d.count));
  const rows = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: countsByRating.get(rating) ?? 0,
    percentage: total_reviews > 0 ? (countsByRating.get(rating) ?? 0) / total_reviews : 0,
  }));

  const categoryRows = categories ?? [];

  return (
    <div className="space-y-5">
      {/* Overall + distribution */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Overall rating */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1 sm:shrink-0">
          <span className="text-4xl font-black text-slate-900 tracking-tight tabular-nums">
            {formatAverage(average_rating)}
          </span>
          <div>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4',
                    star <= Math.round(average_rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-slate-200 text-slate-200',
                  )}
                />
              ))}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {total_reviews} {total_reviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>
        </div>

        {/* Distribution bars */}
        <div className="flex-1 space-y-1.5">
          {rows.map((row) => (
            <div key={row.rating} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs font-bold text-slate-500 tabular-nums">
                {row.rating}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${row.percentage * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      {categoryRows.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <div
            className={cn(
              'grid gap-x-6 gap-y-1.5',
              showAll ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
            )}
          >
            {(showAll ? categoryRows : categoryRows.slice(0, 4)).map((cat) => (
              <div key={cat.key} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-500">
                  {cat.label}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-900 tabular-nums">
                  {cat.average != null ? formatAverage(cat.average) : '—'}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
              </div>
            ))}
          </div>
          {categoryRows.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              {showAll ? (
                <>
                  Show less
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show all categories
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}