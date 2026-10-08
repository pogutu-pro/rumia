'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { NoPhotoTile } from '@/components/ui/no-photo-tile';
import type { components } from '@/lib/api/schema';
import { track } from '@/lib/events';

type Media = components['schemas']['MediaRead'];

const ROOM_LABEL: Record<string, string> = {
  exterior: 'Outside',
  room: 'Room',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  common: 'Shared space',
  view: 'View',
  other: 'Photo',
};

export function mediaAlt(name: string, m: Media, index: number): string {
  if (m.kind === 'video') return `Video tour of ${name}`;
  return `${ROOM_LABEL[m.room_tag] ?? 'Photo'} at ${name}${index > 0 ? ` (${index + 1})` : ''}`;
}

/** Video first (it sells best), then photos in the lister's order. */
export function orderMedia(media: Media[]): Media[] {
  const videos = media.filter((m) => m.kind === 'video');
  const photos = media.filter((m) => m.kind !== 'video');
  return [...videos, ...photos];
}

function youtubePoster(id: string | null | undefined): string | null {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function Slide({ m, name, index, priority, onOpen }: { m: Media; name: string; index: number; priority?: boolean; onOpen: () => void }) {
  const src = m.kind === 'video' ? youtubePoster(m.external_id) : m.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={m.kind === 'video' ? 'Play video tour' : `Open photo ${index + 1}`}
      className="relative block h-full w-full overflow-hidden bg-rum-sunken"
    >
      {src ? (
        <Image
          src={src}
          alt={mediaAlt(name, m, index)}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
          priority={priority}
          placeholder={m.blur_data_url ? 'blur' : undefined}
          blurDataURL={m.blur_data_url ?? undefined}
        />
      ) : (
        <NoPhotoTile />
      )}
      {m.kind === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-rum-text shadow-rum-float">
            <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
          </span>
        </span>
      )}
    </button>
  );
}

function Viewer({ items, name, start, onClose }: { items: Media[]; name: string; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = items[index];
  const go = useCallback((d: number) => setIndex((i) => (i + d + items.length) % items.length), [items.length]);

  useEffect(() => {
    const el = dialogRef.current;
    el?.showModal();
    return () => el?.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`${name} photos`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm" aria-live="polite">
            {index + 1} / {items.length}
            {current.kind !== 'video' && <span className="text-white/70"> · {ROOM_LABEL[current.room_tag] ?? 'Photo'}</span>}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="relative flex-1">
          {current.kind === 'video' && current.external_id ? (
            <iframe
              title={`Video tour of ${name}`}
              src={`https://www.youtube-nocookie.com/embed/${current.external_id}?autoplay=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : current.url ? (
            <Image
              key={current.id}
              src={current.url}
              alt={mediaAlt(name, current, index)}
              fill
              sizes="100vw"
              className="object-contain"
              placeholder={current.blur_data_url ? 'blur' : undefined}
              blurDataURL={current.blur_data_url ?? undefined}
            />
          ) : null}
          {items.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15">
                <ChevronLeft className="h-7 w-7" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15">
                <ChevronRight className="h-7 w-7" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function MediaGallery({ media, name }: { media: Media[]; name: string }) {
  const items = useMemo(() => orderMedia(media), [media]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const open = (i: number) => {
    setViewer(i);
    track('media_engaged', { surface: 'property', props: { kind: items[i]?.kind, index: i } });
  };

  if (items.length === 0) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-rum-sunken lg:rounded-rum-media">
        <NoPhotoTile />
      </div>
    );
  }

  return (
    <>
      {/* Phones and tablets: swipe */}
      <div className="relative lg:hidden">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="rum-scroll-x flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto sm:aspect-[16/10]"
          role="group"
          aria-label={`${name} photos`}
        >
          {items.map((m, i) => (
            <div key={m.id} className="relative h-full w-full shrink-0 snap-center">
              <Slide m={m} name={name} index={i} priority={i === 0} onOpen={() => open(i)} />
            </div>
          ))}
        </div>
        <p className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white" aria-hidden="true">
          {Math.min(active + 1, items.length)} / {items.length}
        </p>
      </div>

      {/* Laptops and up: mosaic */}
      <div className="hidden h-[26rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-rum-media lg:grid">
        <div className="col-span-2 row-span-2">
          <Slide m={items[0]} name={name} index={0} priority onOpen={() => open(0)} />
        </div>
        {items.slice(1, 5).map((m, i) => (
          <div key={m.id} className="relative">
            <Slide m={m} name={name} index={i + 1} onOpen={() => open(i + 1)} />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - (items.length - 1)) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-rum-sunken" />
        ))}
      </div>
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => open(0)}
          className="mt-2 hidden min-h-11 rounded-rum-control border border-rum-line bg-rum-raised px-4 text-sm font-semibold text-rum-text lg:inline-flex lg:items-center"
        >
          Show all {items.length} photos
        </button>
      )}

      {viewer !== null && <Viewer items={items} name={name} start={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
