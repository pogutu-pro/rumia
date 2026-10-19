'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { BnbStay } from '@/lib/site/bnb-api';
import { kes, stayFacts, stayImages, stayKind, stayPath, stayPlace } from '@/lib/site/stay-format';
import { estimateTotal, nightsBetween, searchQuery, type StaySearch } from '@/lib/site/stay-search';
import { SaveButton } from '@/components/ui/save-button';
import { Photo } from './photo';
import { cn } from '@/lib/utils/cn';

const MAX_PHOTOS = 6;

/**
 * A stay in a grid, the way people browse Airbnb: swipe the photos, tap the heart, read the place and the price.
 * With dates chosen it shows the total for the trip (cleaning included), not just the nightly rate.
 */
export function StayCard({ stay, search, priority = false }: { stay: BnbStay; search?: StaySearch; priority?: boolean }) {
  const photos = stayImages(stay).slice(0, MAX_PHOTOS);
  const fallback = !photos.length && stay.youtube_id ? [{ url: `https://img.youtube.com/vi/${stay.youtube_id}/hqdefault.jpg`, blur: null }] : [];
  const slides = photos.length ? photos : fallback;
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const nights = search ? nightsBetween(search.checkIn, search.checkOut) : 0;
  const total = estimateTotal(stay, nights);
  const href = `${stayPath(stay)}${search ? searchQuery({ checkIn: search.checkIn, checkOut: search.checkOut, guests: search.guests }) : ''}`;
  const facts = [stayKind(stay), ...stayFacts(stay).slice(0, 2)].filter(Boolean).join(' · ');

  function go(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <Link href={href} className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest">
      <div className="relative aspect-[20/19] overflow-hidden rounded-2xl bg-bnb-line">
        <div
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((img, i) => (
            <div key={img.url} className="relative h-full w-full shrink-0 snap-center">
              <Photo
                src={img.url}
                size="gallery"
                alt={i === 0 ? stay.title : ''}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 560px) 50vw, 100vw"
                className="object-cover"
                priority={priority && i === 0}
                blur={img.blur}
              />
            </div>
          ))}
        </div>

        {stay.youtube_id && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-bnb-ink shadow-sm">
            <Play className="h-3 w-3 fill-current" aria-hidden /> Video tour
          </span>
        )}
        <div className="absolute right-2.5 top-2.5 z-10">
          <SaveButton listingId={String(stay.id)} variant="icon" className="h-11 w-11 border-white/70 bg-white/90 shadow-sm" />
        </div>

        {slides.length > 1 && (
          <>
            <button type="button" onClick={(e) => go(-1, e)} aria-label="Previous photo" className={cn('absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-bnb-ink shadow transition-opacity md:grid', index === 0 ? 'opacity-0' : 'opacity-0 group-hover:opacity-100')}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={(e) => go(1, e)} aria-label="Next photo" className={cn('absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-bnb-ink shadow transition-opacity md:grid', index >= slides.length - 1 ? 'opacity-0' : 'opacity-0 group-hover:opacity-100')}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" aria-hidden>
              {slides.map((s, i) => (
                <span key={s.url} className={cn('h-1.5 w-1.5 rounded-full bg-white transition-opacity', i === index ? 'opacity-100' : 'opacity-55')} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 space-y-0.5">
        <h3 className="truncate font-semibold text-bnb-ink">{stayPlace(stay)}</h3>
        <p className="truncate text-[15px] text-bnb-stone">{stay.title}</p>
        {facts && <p className="truncate text-[15px] text-bnb-stone">{facts}</p>}
        <p className="pt-1 text-[15px] text-bnb-ink">
          {total ? (
            <>
              <span className="font-semibold underline decoration-1 underline-offset-2">{kes(total.total)}</span> for {nights} {nights === 1 ? 'night' : 'nights'}
            </>
          ) : (
            <>
              <span className="font-semibold">{kes(stay.price)}</span> night
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
