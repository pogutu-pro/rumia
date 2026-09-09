import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  ExploreListingCard,
  type ExploreListing,
} from './explore-listing-card';

interface ListingSectionProps {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  items: ExploreListing[];
}

export function ListingSection({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = 'See all',
  items,
}: ListingSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-6 lg:px-8">
      <div className="mb-2.5 sm:mb-3.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold tracking-tight text-slate-900 xs:text-lg sm:text-xl truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex shrink-0 items-center gap-1 py-1 px-1 -mr-1 text-xs sm:text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 touch-manipulation"
          >
            {seeAllLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1 pb-2.5 sm:mx-0 sm:gap-4 sm:px-0 overscroll-x-contain">
        {items.map((item) => (
          <ExploreListingCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
