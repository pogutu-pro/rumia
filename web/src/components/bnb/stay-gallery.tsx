'use client';

import { useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import type { StayImage } from '@/lib/site/stay-format';
import { mostlyPortrait } from '@/lib/site/photos';
import { cn } from '@/lib/utils/cn';
import { Photo } from './photo';
import { PhotoTour } from './photo-tour';

/**
 * Photos first, framed to their shape:
 *  - landscape photos: Airbnb's mosaic (one large, the rest small);
 *  - mostly portrait (phone photos held upright): a row of tall tiles, so little of each photo is cut away;
 *  - phones: a swipe carousel, 4:5 for portrait sets and 4:3 otherwise, with a counter;
 *  - "Show all photos": the photo tour (photo-tour.tsx); tapping any photo opens it full screen.
 */
export function StayGallery({ title, images, actions }: { title: string; images: StayImage[]; actions?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const portrait = mostlyPortrait(images);
  const alt = (i: number) => (i === 0 ? title : `${title}, photo ${i + 1}`);
  const tile = 'group relative overflow-hidden bg-bnb-line';
  const hover = 'object-cover transition duration-300 group-hover:brightness-90 motion-reduce:transition-none';
  const showAll = images.length > 1 && (
    <button type="button" onClick={() => setAll(true)} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-bnb-ink bg-white px-4 py-2 text-sm font-semibold text-bnb-ink shadow-sm hover:bg-bnb-mist">
      <Grid3x3 className="h-4 w-4" aria-hidden /> Show all {images.length} photos
    </button>
  );

  const mosaic = images.slice(0, 5);
  const desktop = portrait ? (
    // Tall tiles side by side; five at most, the last ones only on wider screens.
    <div className="relative hidden h-[min(34rem,46vw)] gap-2 overflow-hidden rounded-3xl md:flex">
      {images.slice(0, 5).map((img, i) => (
        <button key={img.url} type="button" onClick={() => setZoom(i)} className={cn(tile, 'h-full min-w-0 flex-1', i === 4 && 'hidden xl:block', i === 3 && 'hidden lg:block')} aria-label={`Open ${alt(i)}`}>
          <Photo src={img.url} size="gallery" alt={alt(i)} blur={img.blur} priority={i < 2} sizes="25vw" className={hover} />
        </button>
      ))}
      {showAll}
    </div>
  ) : (
    <div className={cn('relative hidden gap-2 overflow-hidden rounded-3xl md:grid', mosaic.length >= 4 ? 'h-[min(30rem,52vw)] grid-cols-4 grid-rows-2' : mosaic.length === 3 ? 'h-[min(28rem,48vw)] grid-cols-3 grid-rows-2' : 'h-[min(28rem,48vw)] grid-cols-2')}>
      {mosaic.map((img, i) => (
        <button
          key={img.url}
          type="button"
          onClick={() => setZoom(i)}
          className={cn(
            tile,
            i === 0 && mosaic.length >= 3 && 'col-span-2 row-span-2',
            i === 0 && mosaic.length === 1 && 'col-span-2',
            // Four photos: one large, one tall, two stacked, so none is hidden.
            i === 1 && mosaic.length === 4 && 'row-span-2',
          )}
          aria-label={`Open ${alt(i)}`}
        >
          <Photo src={img.url} size={i === 0 ? 'large' : 'gallery'} alt={alt(i)} blur={img.blur} priority={i === 0} sizes={i === 0 ? '50vw' : '25vw'} className={hover} />
        </button>
      ))}
      {showAll}
    </div>
  );

  return (
    <>
      {/* Phones: full-bleed carousel */}
      <div className="relative -mx-4 md:hidden">
        <div
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className={cn('flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', portrait ? 'aspect-[4/5]' : 'aspect-[4/3]')}
        >
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setZoom(i)} className="relative h-full w-full shrink-0 snap-center bg-bnb-line" aria-label={`Open ${alt(i)}`}>
              <Photo src={img.url} size="gallery" alt={alt(i)} blur={img.blur} priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {actions && <div className="absolute right-3 top-3 flex gap-2">{actions}</div>}
        <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          {index + 1} / {images.length}
        </span>
      </div>

      {desktop}

      <PhotoTour title={title} images={images} open={all || zoom !== null} startAt={zoom} onOpenChange={(o) => { if (!o) { setAll(false); setZoom(null); } }} />
    </>
  );
}
