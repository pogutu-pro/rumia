'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check, Footprints, GitCompareArrows, MapPin, Star } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import { cn } from '@/lib/utils/cn';
import { formatAreaName } from '@/lib/utils/area-label';
import { listingPath } from '@/lib/utils/listing-path';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { cardHighlights, cardKind, startingPrice } from '@/lib/search/explore';
import type { SearchListing } from '@/lib/search/types';

const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDUwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';

interface ResultCardProps {
  item: SearchListing & { rating?: number | null; review_count?: number | null };
  comparing: boolean;
  onToggleCompare: () => void;
  /** The first row loads eagerly: it is the page's largest paint. */
  priority?: boolean;
}

/**
 * One Explore result, in the language of the Home cards and the big rental sites: the photo carries the walk time
 * and the save heart; below it, name, kind and area, up to three stated facts, and the rent. The whole card opens
 * the listing; the heart and Compare are separate buttons beside the link, not inside it.
 */
export function ResultCard({ item, comparing, onToggleCompare, priority = false }: ResultCardProps) {
  const images = [...(item.listing_images ?? [])].sort((a, b) => a.display_order - b.display_order);
  const cover = images[0];
  const href = item.slug ? listingPath(item) : `/listing/${item.id}`;
  const walk = getDistanceBadgeText(item.distance_category);
  const areaName = item.area ? formatAreaName(item.area) : null;
  // Some listers repeat the area as the specific location ("Nyeri view · nyeri view"): say it once.
  const spot = item.specific_location?.trim();
  const area = [areaName, spot && spot.toLowerCase() !== areaName?.toLowerCase() ? spot : null].filter(Boolean).join(' · ');
  const walking = item.distance_category === 'walking-500m' || item.distance_category === '5-10min';
  const highlights = cardHighlights(item);
  const price = startingPrice(item);
  const reviews = typeof item.review_count === 'number' && item.review_count > 0 ? item.review_count : 0;
  const rating = reviews > 0 && typeof item.rating === 'number' && item.rating > 0 ? item.rating : null;
  const genderTag = item.gender === 'female' ? 'Ladies only' : item.gender === 'male' ? 'Gents only' : null;

  return (
    <article className="group relative">
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
          {cover?.r2_url ? (
            <Image
              src={cover.r2_url}
              alt={`${item.title}, ${cardKind(item).toLowerCase()} in ${item.area ?? 'Nyeri'}`}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              placeholder="blur"
              blurDataURL={cover.blur_data_url || FALLBACK_BLUR}
            />
          ) : (
            <NoPhotoTile />
          )}
          {walk && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
              {walking ? <Footprints className="h-3.5 w-3.5" aria-hidden /> : <MapPin className="h-3.5 w-3.5" aria-hidden />}
              {walk}
            </span>
          )}
          {(genderTag || item.is_full) && (
            <span
              className={cn(
                'absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm',
                item.is_full ? 'bg-white text-red-600' : 'bg-white/95 text-ink',
              )}
            >
              {item.is_full ? 'Fully occupied' : genderTag}
            </span>
          )}
        </div>

        <div className="mt-3 pr-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-1 text-[15px] font-semibold text-ink">{item.title}</h2>
            {rating !== null && (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink">
                <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                {rating.toFixed(1)}
                <span className="text-ink-muted">({reviews})</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">
            {cardKind(item)}
            {area ? ` · ${area}` : ''}
          </p>
          {highlights.length > 0 && <p className="line-clamp-1 text-sm text-ink-muted">{highlights.join(' · ')}</p>}
          <p className="mt-1.5 text-[15px] text-ink">
            {item.listing_room_types && item.listing_room_types.length > 1 && <span className="text-ink-muted">From </span>}
            <span className="font-semibold">KES {price.toLocaleString()}</span>
            <span className="text-ink-muted"> / month</span>
          </p>
        </div>
      </Link>

      <div className="absolute right-3 top-3">
        <SaveButton listingId={String(item.id)} variant="icon" className="h-9 w-9 border-white/60 bg-white/95 shadow-sm" />
      </div>

      <button
        type="button"
        onClick={onToggleCompare}
        aria-pressed={comparing}
        className={cn(
          'absolute -bottom-1 right-0 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          comparing ? 'text-primary' : 'text-ink-muted hover:text-ink',
        )}
      >
        {comparing ? <Check className="h-4 w-4" aria-hidden /> : <GitCompareArrows className="h-4 w-4" aria-hidden />}
        {comparing ? 'Comparing' : 'Compare'}
      </button>
    </article>
  );
}
