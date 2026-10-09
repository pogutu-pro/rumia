'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Clock, Footprints } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { formatCurrency } from '@/lib/utils/currency';
import { listingPath } from '@/lib/utils/listing-path';
import { rememberInterest } from '@/lib/personalisation';
import type { SearchCard } from '@/lib/api/rumia';

/** Where a card from the discovery API lives in the existing site. Short stays have their own pages. */
export function cardHref(card: Pick<SearchCard, 'kind' | 'slug' | 'listing_id'>): string {
  if ((card.kind === 'house' || card.kind === 'room') && card.listing_id) return `/bnb/${card.listing_id}`;
  return listingPath({ slug: card.slug });
}

const PERIOD: Record<string, string> = { month: '/ month', night: '/ night', week: '/ week', semester: '/ semester' };

/** A result card for the discovery API, styled like the site's other listing cards. */
export function DiscoveryCard({ card }: { card: SearchCard }) {
  const unavailable = card.status === 'let' || card.status === 'paused';
  return (
    <div className="group relative">
      <Link
        href={cardHref(card)}
        onClick={() => rememberInterest({ kind: card.kind, place: card.place_name, price: card.from_price })}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/[0.04]">
          {card.cover_url ? (
            <Image
              src={card.cover_url}
              alt={card.name}
              fill
              sizes="(min-width: 1024px) 280px, 50vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-[1.02] ${unavailable ? 'opacity-60' : ''}`}
              placeholder={card.cover_blur ? 'blur' : undefined}
              blurDataURL={card.cover_blur || undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">No photo yet</div>
          )}
          {unavailable && (
            <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
              {card.status === 'let' ? 'Let' : 'Paused'}
            </span>
          )}
        </div>
        <div className="mt-2 space-y-0.5 px-0.5">
          <h3 className="line-clamp-1 flex items-center gap-1 text-sm font-semibold text-slate-900">
            {card.name}
            {card.flags.registry && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Verified" />}
          </h3>
          {card.place_name && <p className="line-clamp-1 text-xs text-slate-500">{card.place_name}</p>}
          {card.from_price != null && (
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(card.from_price)}
              <span className="ml-1 text-xs font-normal text-slate-500">{PERIOD[card.price_period ?? 'month'] ?? '/ month'}</span>
            </p>
          )}
          {card.move_in_total != null && card.move_in_total !== card.from_price && (
            <p className="text-xs text-slate-500">{formatCurrency(card.move_in_total)} to move in</p>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {card.walk_min != null && (
              <span className="inline-flex items-center gap-1">
                <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
                {card.walk_min} min{card.walk_to ? ` to ${card.walk_to}` : ''}
              </span>
            )}
            {card.freshness && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {card.freshness}
              </span>
            )}
          </p>
          {card.reason && <p className="line-clamp-2 text-xs text-emerald-700">{card.reason}</p>}
        </div>
      </Link>
      {card.listing_id && <SaveButton listingId={card.listing_id} variant="icon" className="absolute right-2 top-2" />}
    </div>
  );
}
