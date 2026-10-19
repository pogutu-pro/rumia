'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import type { StayImage } from '@/lib/site/stay-format';
import { track } from '@/lib/events';

/**
 * Video first, then photos. A vertical tour (Shorts) sits beside the photos on wide screens and leads on phones;
 * photos scroll sideways with snap, each one full width on a phone.
 */
export function StayMedia({
  title,
  listingId,
  images,
  youtubeId,
  isShort,
}: {
  title: string;
  listingId: string;
  images: StayImage[];
  youtubeId?: string | null;
  isShort?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  const video = youtubeId ? (
    <div className={isShort ? 'mx-auto aspect-[9/16] w-full max-w-sm lg:max-w-none' : 'aspect-video w-full'}>
      {playing ? (
        <iframe
          className="h-full w-full rounded-[1.5rem]"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={`Video tour of ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            track('media_engaged', { surface: 'property', listingId, props: { kind: 'video', product: 'bnb' } });
          }}
          className="group relative block h-full w-full overflow-hidden rounded-[1.5rem] bg-bnb-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest"
          aria-label={`Play the video tour of ${title}`}
        >
          <Image src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt="" fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" priority />
          <span className="absolute inset-0 bg-bnb-ink/25" aria-hidden />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-5 text-left text-white">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bnb-amber text-bnb-ink transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden />
            </span>
            <span className="font-bnb-display text-lg font-bold leading-tight">Watch the tour</span>
          </span>
        </button>
      )}
    </div>
  ) : null;

  const photos =
    images.length > 0 ? (
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label={`Photos of ${title}`}
      >
        {images.map((img, i) => (
          <li key={img.url} className="relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-[1.25rem] bg-bnb-line sm:w-[70%] lg:w-[48%]">
            <Image
              src={img.url}
              alt={i === 0 ? title : `${title}, photo ${i + 1}`}
              fill
              sizes="(min-width: 1024px) 40vw, 88vw"
              className="object-cover"
              priority={i === 0 && !youtubeId}
              placeholder={img.blur ? 'blur' : 'empty'}
              blurDataURL={img.blur ?? undefined}
            />
          </li>
        ))}
      </ul>
    ) : null;

  if (video && isShort) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        {video}
        {photos}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {video}
      {photos}
    </div>
  );
}
