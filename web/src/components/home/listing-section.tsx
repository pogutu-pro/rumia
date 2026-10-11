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
  /** A collection with fewer real items than this is not shown. */
  minItems?: number;
}

/**
 * One collection. In a narrow container the cards scroll horizontally; once the container is wide enough they
 * sit in one row of 3 or 4 equal cards (container queries, so an open side panel is accounted for). The rest are
 * reachable through "See all".
 */
export function ListingSection({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = 'See all',
  items,
  minItems = 3,
}: ListingSectionProps) {
  if (items.length < minItems) return null;
  return (
    <section className="@container w-full px-4 pt-8 lg:px-8">
      <div className="flex items-end justify-between gap-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-7 tracking-tight text-ink text-balance sm:text-xl">
            {title}
          </h2>
          {subtitle && <p className="text-sm leading-5 text-ink-muted">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {seeAllLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div
        aria-label="Property listings"
        className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 @xl:mx-0 @xl:grid @xl:snap-none @xl:grid-cols-3 @xl:gap-4 @xl:overflow-visible @xl:px-0 @xl:pb-0 @xl:[&>*:nth-child(n+4)]:hidden @4xl:grid-cols-4 @4xl:[&>*:nth-child(n+4)]:flex @4xl:[&>*:nth-child(n+5)]:hidden"
      >
        {items.map((item) => (
          <ExploreListingCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
