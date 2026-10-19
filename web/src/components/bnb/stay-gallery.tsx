'use client';

import { useState } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, Grid3x3 } from 'lucide-react';
import type { StayImage } from '@/lib/site/stay-format';
import { Lightbox } from '@/components/ui/lightbox';
import { cn } from '@/lib/utils/cn';

/**
 * Photos as on Airbnb: a mosaic on wide screens (one large, four small) with "Show all photos", a full-width swipe
 * carousel with a counter on phones, and a full-screen view of every photo.
 */
export function StayGallery({ title, images, actions }: { title: string; images: StayImage[]; actions?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const alt = (i: number) => (i === 0 ? title : `${title}, photo ${i + 1}`);
  const mosaic = images.slice(0, 5);

  return (
    <>
      {/* Phones: full-bleed carousel */}
      <div className="relative -mx-4 md:hidden">
        <div
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setAll(true)} className="relative h-full w-full shrink-0 snap-center" aria-label={`Open ${alt(i)}`}>
              <Image src={img.url} alt={alt(i)} fill sizes="100vw" className="object-cover" priority={i === 0} placeholder={img.blur ? 'blur' : 'empty'} blurDataURL={img.blur ?? undefined} />
            </button>
          ))}
        </div>
        {actions && <div className="absolute right-3 top-3 flex gap-2">{actions}</div>}
        <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          {index + 1} / {images.length}
        </span>
      </div>

      {/* Wide screens: mosaic */}
      <div className={cn('relative hidden gap-2 overflow-hidden rounded-3xl md:grid', mosaic.length >= 4 ? 'h-[min(30rem,52vw)] grid-cols-4 grid-rows-2' : mosaic.length >= 3 ? 'h-[min(28rem,48vw)] grid-cols-3 grid-rows-2' : 'h-[min(28rem,48vw)] grid-cols-2')}>
        {mosaic.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setZoom(i)}
            className={cn(
              'group relative overflow-hidden bg-bnb-line',
              i === 0 && mosaic.length >= 3 && 'col-span-2 row-span-2',
              i === 0 && mosaic.length === 1 && 'col-span-2',
              // Four photos: one large, one tall, two stacked, so none is hidden.
              i === 1 && mosaic.length === 4 && 'row-span-2',
            )}
            aria-label={`Open ${alt(i)}`}
          >
            <Image
              src={img.url}
              alt={alt(i)}
              fill
              sizes={i === 0 ? '50vw' : '25vw'}
              className="object-cover transition duration-300 group-hover:brightness-90 motion-reduce:transition-none"
              priority={i === 0}
              placeholder={img.blur ? 'blur' : 'empty'}
              blurDataURL={img.blur ?? undefined}
            />
          </button>
        ))}
        {images.length > 1 && (
          <button type="button" onClick={() => setAll(true)} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-bnb-ink bg-white px-4 py-2 text-sm font-semibold text-bnb-ink shadow-sm hover:bg-bnb-mist">
            <Grid3x3 className="h-4 w-4" aria-hidden /> Show all photos
          </button>
        )}
      </div>

      <Dialog.Root open={all} onOpenChange={setAll}>
        <Dialog.Portal>
          <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto bg-white focus:outline-none">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bnb-line bg-white/95 px-4 py-3 backdrop-blur">
              <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full hover:bg-bnb-mist" aria-label="Close photos">
                <ChevronLeft className="h-5 w-5" />
              </Dialog.Close>
              <Dialog.Title className="font-semibold text-bnb-ink">{title}</Dialog.Title>
              <span className="w-10" />
            </div>
            <div className="mx-auto grid max-w-3xl gap-2 p-4 sm:grid-cols-2">
              {images.map((img, i) => (
                <button key={img.url} type="button" onClick={() => setZoom(i)} className={cn('relative overflow-hidden rounded-lg bg-bnb-line', i % 3 === 0 ? 'aspect-[3/2] sm:col-span-2' : 'aspect-square')}>
                  <Image src={img.url} alt={alt(i)} fill sizes="(min-width: 640px) 768px, 100vw" className="object-cover" />
                </button>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Lightbox images={images.map((img, i) => ({ url: img.url, alt: alt(i) }))} currentIndex={zoom ?? 0} isOpen={zoom !== null} onClose={() => setZoom(null)} />
    </>
  );
}
