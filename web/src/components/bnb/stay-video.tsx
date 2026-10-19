'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { track } from '@/lib/events';
import { cn } from '@/lib/utils/cn';

/** The video tour: a poster until played, vertical for Shorts. */
export function StayVideo({ videoId, isShort, title, listingId }: { videoId: string; isShort?: boolean; title: string; listingId: string }) {
  const [playing, setPlaying] = useState(false);
  const box = cn('relative overflow-hidden rounded-2xl bg-bnb-ink', isShort ? 'aspect-[9/16] w-full max-w-xs' : 'aspect-video w-full');
  if (playing) {
    return (
      <div className={box}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={`Video tour of ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
        track('media_engaged', { surface: 'property', listingId, props: { kind: 'video', product: 'bnb' } });
      }}
      className={cn(box, 'group block')}
      aria-label={`Play the video tour of ${title}`}
    >
      <Image src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover opacity-90" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-bnb-ink shadow-lg transition-transform group-hover:scale-105 motion-reduce:transition-none">
          <Play className="h-7 w-7 translate-x-0.5 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
