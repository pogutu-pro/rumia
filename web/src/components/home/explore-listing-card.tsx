'use client';

import { listingPath } from '@/lib/utils/listing-path';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Check, GitCompareArrows, MapPin, Star } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import { formatCurrency } from '@/lib/utils/currency';
import { formatAreaName } from '@/lib/utils/area-label';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { useCompareToggle } from '@/hooks/use-compare-toggle';
import { cn } from '@/lib/utils/cn';
import type { PropertyType } from '@/types';

export interface ExploreListing {
  id: string;
  title: string;
  price: number;
  location: string;
  slug?: string | null;
  county?: string | null;
  area?: string | null;
  property_type?: PropertyType | string | null;
  distance_category?: string | null;
  room_type?: string | null;
  bathroom_type?: string | null;
  wifi_included?: boolean | null;
  rating?: number | null;
  review_count?: number | null;
  views?: number | null;
  created_at?: string | null;
  image_url?: string | null;
  blur_data_url?: string | null;
  verified?: boolean | null;
}

export function propertyTypeLabel(v?: PropertyType | string | null): string {
  if (v === 'apartment') return 'Apartment';
  if (v === 'short_stay') return 'Short stay';
  return 'Hostel';
}

export function pricePeriod(v?: PropertyType | string | null): string {
  return v === 'short_stay' ? '/ night' : '/ month';
}

/** At most three facts the listing really states. Nothing is inferred. */
function attributeChips(item: ExploreListing): string[] {
  const chips: string[] = [];
  if (item.room_type) chips.push(item.room_type);
  if (item.bathroom_type) chips.push(item.bathroom_type);
  if (item.wifi_included) chips.push('Wi-Fi');
  return chips.slice(0, 3);
}

export function ExploreListingCard({ item }: { item: ExploreListing }) {
  const type = (item.property_type ?? 'hostel') as PropertyType;
  const href =
    item.slug ? `${listingPath(item)}` : type === 'short_stay' ? `/bnb/${item.id}` : `/listing/${item.id}`;
  const distance = item.distance_category
    ? getDistanceBadgeText(item.distance_category)
    : null;
  const place = formatAreaName(item.area) || item.location || 'Nyeri';
  const chips = attributeChips(item);
  const reviewCount = typeof item.review_count === 'number' && item.review_count > 0 ? item.review_count : 0;
  // Show a rating only when real published reviews stand behind it.
  const rating = reviewCount > 0 && typeof item.rating === 'number' && item.rating > 0 ? item.rating : null;
  const { isComparing, toggle } = useCompareToggle();
  const comparing = isComparing(String(item.id));
  const canCompare = type !== 'short_stay';

  // The heart and Compare sit beside the link (absolutely placed), not inside it: a button inside a link is invalid
  // and can open the listing instead of saving or comparing.
  return (
    <div className="group relative flex h-full w-[min(62vw,15rem)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-raised transition-shadow hover:shadow-md @xl:w-auto">
    <Link
      href={href}
      className="flex flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-subtle">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 28vw, 62vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            placeholder={item.blur_data_url ? 'blur' : undefined}
            blurDataURL={item.blur_data_url || undefined}
          />
        ) : (
          <NoPhotoTile />
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-raised px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm ring-1 ring-black/5">
          {propertyTypeLabel(type)}
        </span>
        {item.verified && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
            <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
          </span>
        )}
      </div>

      <div className={cn('flex flex-1 flex-col gap-1.5 p-3', canCompare && 'pb-14')}>
        <h3 className="line-clamp-1 text-[15px] font-semibold leading-5 text-ink group-hover:text-primary">
          {item.title}
        </h3>
        <p className="flex items-center gap-1 text-[13px] leading-5 text-ink-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
          <span className="truncate">
            {place}
            {distance ? ` · ${distance}` : ''}
          </span>
        </p>
        <p className="text-base font-bold leading-6 tracking-tight text-ink">
          {formatCurrency(item.price)}
          <span className="ml-1 text-xs font-medium text-ink-muted">{pricePeriod(type)}</span>
        </p>
        {(chips.length > 0 || rating !== null) && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                {c}
              </span>
            ))}
            {rating !== null && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ink">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="sr-only">Rated </span>
                {rating.toFixed(1)}
                <span className="font-normal text-ink-muted">
                  <span aria-hidden>({reviewCount})</span>
                  <span className="sr-only">
                    {' '}
                    from {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                  </span>
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
      <div className="absolute right-2 top-2 z-10">
        <SaveButton listingId={String(item.id)} variant="icon" className="h-9 w-9 border-white/60 bg-white shadow-sm" />
      </div>
      {canCompare && (
        <button
          type="button"
          onClick={() =>
            toggle({
              id: String(item.id),
              title: item.title,
              price: item.price,
              imageUrl: item.image_url ?? undefined,
              slug: item.slug,
              county: item.county,
              area: item.area,
              roomType: item.room_type,
              bathroomType: item.bathroom_type,
              distanceCategory: item.distance_category,
              wifiIncluded: item.wifi_included,
            })
          }
          aria-pressed={comparing}
          aria-label={comparing ? `Remove ${item.title} from compare` : `Compare ${item.title}`}
          className={cn(
            'absolute inset-x-3 bottom-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            comparing ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-300 bg-white text-ink hover:border-ink',
          )}
        >
          {comparing ? <Check className="h-4 w-4" aria-hidden /> : <GitCompareArrows className="h-4 w-4" aria-hidden />}
          {comparing ? 'Comparing' : 'Compare'}
        </button>
      )}
    </div>
  );
}
