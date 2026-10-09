import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  ExploreListingCard,
  type ExploreListing,
} from './explore-listing-card';

interface ListingSectionProps {
  title: React.ReactNode;
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
    <section className="mx-auto w-full max-w-6xl px-4 lg:px-8">
      <div className="flex items-start justify-between gap-4 pb-4 pt-8">
        <div className="flex-1">
          <h2 className="text-lg font-bold leading-7 tracking-tight text-slate-900 text-balance sm:text-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {seeAllLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div
        aria-label="Scrollable property listings"
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 sm:gap-4 lg:px-0"
      >
        {items.map((item) => (
          <ExploreListingCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
