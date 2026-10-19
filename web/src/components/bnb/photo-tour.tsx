'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { StayImage } from '@/lib/site/stay-format';
import { isPortrait } from '@/lib/site/photos';
import { cn } from '@/lib/utils/cn';
import { Photo } from './photo';

type Row = { kind: 'wide'; i: number } | { kind: 'pair'; i: [number, number] } | { kind: 'single'; i: number };

/** Wide photos take a full row; tall photos go two by two in matching frames, like Airbnb's photo tour. */
export function tourRows(images: Pick<StayImage, 'width' | 'height'>[]): Row[] {
  const rows: Row[] = [];
  let waiting: number | null = null;
  images.forEach((img, i) => {
    if (!isPortrait(img) && i % 3 === 0) {
      rows.push({ kind: 'wide', i });
    } else if (waiting === null) {
      waiting = i;
    } else {
      rows.push({ kind: 'pair', i: [waiting, i] });
      waiting = null;
    }
  });
  if (waiting !== null) rows.push({ kind: 'single', i: waiting });
  return rows;
}

/**
 * "Show all photos": a calm grid of every photo, then a dark full-screen viewer for one photo at a time (whole, never
 * cropped) with swipe on phones, arrows and keys on wide screens, a counter and thumbnails.
 */
export function PhotoTour({
  title,
  images,
  open,
  onOpenChange,
  startAt = null,
}: {
  title: string;
  images: StayImage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open straight into the viewer at this photo. */
  startAt?: number | null;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [lastStart, setLastStart] = useState<number | null>(null);
  if (open && startAt !== lastStart) {
    setLastStart(startAt);
    setViewing(startAt);
  }
  if (!open && lastStart !== null) setLastStart(null);

  const alt = (i: number) => (i === 0 ? title : `${title}, photo ${i + 1}`);
  const rows = tourRows(images);
  const tile = 'group relative block w-full overflow-hidden rounded-xl bg-bnb-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-forest';
  const img = 'object-cover transition duration-300 group-hover:brightness-95 motion-reduce:transition-none';
  const pick = (i: number, shape: string) => (
    <button key={i} type="button" onClick={() => setViewing(i)} className={cn(tile, shape)} aria-label={`View ${alt(i)}`}>
      <Photo src={images[i].url} size="large" alt={alt(i)} blur={images[i].blur} sizes="(min-width: 768px) 384px, 50vw" className={img} />
    </button>
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setViewing(null);
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto bg-white focus:outline-none" aria-describedby={undefined}>
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-bnb-line bg-white/95 px-3 backdrop-blur md:px-6">
            <Dialog.Close className="grid h-11 w-11 place-items-center rounded-full hover:bg-bnb-mist" aria-label="Close photos">
              <ChevronLeft className="h-6 w-6 text-bnb-ink" />
            </Dialog.Close>
            <Dialog.Title className="truncate px-2 font-semibold text-bnb-ink">{title}</Dialog.Title>
            <span className="w-11 text-right text-sm text-bnb-stone">{images.length}</span>
          </div>

          <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:pt-10">
            <h2 className="mb-6 font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink md:text-3xl">Photo tour</h2>
            <div className="space-y-2 md:space-y-3">
              {rows.map((r, k) =>
                r.kind === 'wide' ? (
                  <div key={k}>{pick(r.i, 'aspect-[3/2]')}</div>
                ) : r.kind === 'pair' ? (
                  <div key={k} className="grid grid-cols-2 gap-2 md:gap-3">
                    {pick(r.i[0], 'aspect-[4/5]')}
                    {pick(r.i[1], 'aspect-[4/5]')}
                  </div>
                ) : (
                  <div key={k} className="grid grid-cols-2 gap-2 md:gap-3">
                    {pick(r.i, 'aspect-[4/5]')}
                  </div>
                ),
              )}
            </div>
          </div>

          {viewing !== null && <Viewer images={images} alt={alt} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Viewer({ images, alt, index, onIndex, onClose }: { images: StayImage[]; alt: (i: number) => string; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (i: number, smooth = true) => {
      const el = track.current;
      const next = Math.max(0, Math.min(images.length - 1, i));
      if (el) el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      onIndex(next);
    },
    [images.length, onIndex],
  );

  // Open at the chosen photo without animating there.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollTo({ left: index * el.clientWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, index, onClose]);

  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const arrow = 'absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-0 md:grid';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111]" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="flex h-14 shrink-0 items-center justify-between px-3 text-white md:h-16 md:px-6">
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-white/10" aria-label="Close viewer">
          <X className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">Close</span>
        </button>
        <span className="text-sm font-semibold tabular-nums" aria-live="polite">
          {index + 1} / {images.length}
        </span>
        <span className="w-11" />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={track}
          onScroll={(e) => {
            const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth));
            if (i !== index) onIndex(i);
          }}
          className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div key={img.url} className="relative h-full w-full shrink-0 snap-center">
              <div className="absolute inset-0 md:inset-x-20 md:inset-y-2">
                {Math.abs(i - index) <= 2 && (
                  <Photo src={img.url} size="large" alt={alt(i)} blur={img.blur} priority={i === index} sizes="100vw" className="object-contain" />
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={cn(arrow, 'left-4')} aria-label="Previous photo">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={index === images.length - 1} className={cn(arrow, 'right-4')} aria-label="Next photo">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {images.length > 1 && (
        <div ref={thumbs} className="hidden shrink-0 justify-center gap-2 overflow-x-auto px-6 py-4 md:flex">
          {images.map((img, i) => (
            <button
              key={img.url}
              data-i={i}
              type="button"
              onClick={() => go(i)}
              className={cn('relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition', i === index ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-90')}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <Photo src={img.url} size="thumb" alt="" sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
    </div>
  );
}
