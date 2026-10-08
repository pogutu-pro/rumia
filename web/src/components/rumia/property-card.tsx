'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Play } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import type { SearchCard } from '@/lib/api/rumia';
import { KIND_LABEL, UNIT_LABEL, pricePerPeriod } from '@/lib/rumia/format';
import { track } from '@/lib/events';

interface PropertyCardProps {
  card: SearchCard;
  /** Position in the list, sent with the open event so ranking can be evaluated later. */
  position?: number;
  /** First screenful: load eagerly. */
  priority?: boolean;
  surface?: 'explore' | 'saved' | 'property' | 'place';
}

/**
 * The card answers "do I want to see this?" in about a second: price and type, name and area, then one
 * line of location and freshness. Three lines of text, no badges over the photo except video length.
 */
export function PropertyCard({ card, position, priority = false, surface = 'explore' }: PropertyCardProps) {
  const typeLabel = card.unit_kind && card.unit_kind !== 'other' ? UNIT_LABEL[card.unit_kind] : KIND_LABEL[card.kind];
  const gone = card.status === 'let' || card.status === 'paused';
  const detail = [card.reason ?? (card.walk_min && card.walk_to ? `${card.walk_min} min walk to ${card.walk_to}` : null), card.freshness]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(' · ');

  return (
    <article className="group relative">
      <Link
        href={`/p/${card.slug}`}
        onClick={() => track('property_opened', { surface, listingId: card.id, props: { position } })}
        className="block rounded-rum-media focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rum-accent focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-rum-media bg-rum-sunken">
          {card.cover_url ? (
            <Image
              src={card.cover_url}
              alt={`${card.name}${card.place_name ? ` in ${card.place_name}` : ''}`}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
              className={`object-cover ${gone ? 'grayscale' : ''}`}
              priority={priority}
              placeholder={card.cover_blur ? 'blur' : undefined}
              blurDataURL={card.cover_blur ?? undefined}
            />
          ) : (
            <NoPhotoTile />
          )}
          {card.flags.has_video && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
              Video
            </span>
          )}
        </div>
        <div className="mt-2 space-y-0.5 px-0.5">
          <p className="rum-price text-base font-semibold text-rum-text">
            {pricePerPeriod(card.from_price, card.price_period)}
            {typeLabel && <span className="font-normal text-rum-muted"> · {typeLabel}</span>}
          </p>
          <p className="truncate text-sm text-rum-text">
            {card.name}
            {card.place_name && <span className="text-rum-muted"> · {card.place_name}</span>}
          </p>
          {(detail || card.flags.visited) && (
            <p className="flex items-center gap-1 text-sm text-rum-muted">
              {card.flags.visited && (
                <>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-rum-positive" aria-hidden="true" />
                  <span className="sr-only">Visited by Rumia.</span>
                </>
              )}
              <span className="truncate">{gone ? (card.freshness ?? 'No longer available') : detail}</span>
            </p>
          )}
        </div>
      </Link>
      {card.listing_id && (
        <div className="absolute right-2 top-2">
          <SaveButton listingId={card.listing_id} variant="icon" />
        </div>
      )}
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-[4/3] rounded-rum-media bg-rum-sunken" />
      <div className="mt-2 space-y-2">
        <div className="h-4 w-2/3 rounded bg-rum-sunken" />
        <div className="h-4 w-1/2 rounded bg-rum-sunken" />
      </div>
    </div>
  );
}
