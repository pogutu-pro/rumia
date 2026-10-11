'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, MapPin, MessageCircle, PlaySquare, X } from 'lucide-react';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';
import { ContactModal } from '@/app/(public)/listing/[id]/contact-modal';
import { useCampus } from '@/lib/campus-context';
import { readCampusConsultationFee } from '@/lib/utils/consultation-fee';
import { formatCurrency } from '@/lib/utils/currency';
import { categoryLabel, listingHref, placeLabel, pricePeriodLabel } from '@/lib/utils/video-listing';
import type { Listing } from '@/types';
import { VideoPlayer } from './video-player';
import { useVideos } from './video-provider';
import { VideosEmptyState } from './videos-empty-state';

interface VideoPanelProps {
  variant: 'drawer' | 'page';
  onClose?: () => void;
}

/** Height of the first screen: the viewport minus the shell header and the panel header. */
const FIRST_SCREEN = 'h-[calc(100dvh-var(--shell-header-h)-3rem)]';

function ActiveVideoDetails({ listing }: { listing: Listing }) {
  const campus = useCampus();
  const [contactOpen, setContactOpen] = React.useState(false);
  const href = listingHref(listing);
  const agent = listing.agent as { id?: string; phone?: string; whatsapp?: string } | null | undefined;
  const agentPhone = agent?.whatsapp || agent?.phone || '';
  const canContact = !!agent?.id && !!(agentPhone || listing.landlord_phone);
  const place = placeLabel(listing);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;
  const firstImage = listing.images?.[0] as { r2_url?: string } | undefined;
  const actionClass =
    'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-raised px-2 text-xs font-semibold text-ink hover:bg-subtle';

  return (
    <div className="shrink-0">
      <h2 className="line-clamp-1 text-[15px] font-semibold text-ink">{listing.title}</h2>
      <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {categoryLabel(listing)}
          {place ? ` · ${place}` : ''}
        </span>
      </p>
      <p className="mt-1 flex items-baseline gap-1 text-lg font-bold text-ink">
        {formatCurrency(listing.price)}
        <span className="text-xs font-medium text-ink-muted">/ {pricePeriodLabel(listing)}</span>
        {listing.is_full && (
          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            Fully occupied
          </span>
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <SaveButton listingId={String(listing.id)} variant="text" className={`${actionClass} text-xs`} />
        <ShareListingButton
          listing={{ name: listing.title, area: place || 'Nyeri', url: shareUrl, imageUrl: firstImage?.r2_url }}
          variant="text"
          className={actionClass}
        />
        {canContact && (
          <button type="button" onClick={() => setContactOpen(true)} className={actionClass}>
            <MessageCircle className="h-4 w-4" aria-hidden /> Contact
          </button>
        )}
      </div>
      <Link
        href={href}
        className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        View Property <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
      {canContact && (
        <ContactModal
          isOpen={contactOpen}
          onClose={() => setContactOpen(false)}
          listingId={String(listing.id)}
          listingTitle={listing.title}
          agentId={agent?.id ?? ''}
          agentPhone={agentPhone}
          landlordPhone={listing.landlord_phone}
          paysCommission={listing.pays_commission ?? false}
          consultationFee={readCampusConsultationFee(campus as unknown as Record<string, unknown>)}
          isFull={listing.is_full ?? false}
        />
      )}
    </div>
  );
}

function NextVideos({ onPick }: { onPick: (id: string) => void }) {
  const { videos, activeId, hasMore, loadingMore, loadMore } = useVideos();
  const sentinel = React.useRef<HTMLDivElement>(null);
  const others = videos.filter((v) => String(v.id) !== activeId);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, others.length]);

  if (others.length === 0) return null;
  return (
    <section aria-label="More videos" className="border-t border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-ink">More tours</h3>
      <ul className="flex flex-col gap-2">
        {others.map((v) => (
          <li key={String(v.id)}>
            <button
              type="button"
              onClick={() => onPick(String(v.id))}
              className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className={`relative shrink-0 overflow-hidden rounded-lg bg-subtle ${v.is_youtube_shorts ? 'aspect-[9/16] w-16' : 'aspect-video w-28'}`}
              >
                <Image
                  src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="112px"
                  loading="lazy"
                  className="object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <PlaySquare className="h-5 w-5 text-white drop-shadow" aria-hidden />
                </span>
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm font-semibold text-ink">{v.title}</span>
                <span className="block truncate text-xs text-ink-muted">{placeLabel(v)}</span>
                <span className="block text-xs font-semibold text-ink">
                  {formatCurrency(v.price)} / {pricePeriodLabel(v)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-4" aria-live="polite">
          {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-ink-muted" aria-label="Loading more videos" />}
        </div>
      )}
    </section>
  );
}

export function VideoPanel({ variant, onClose }: VideoPanelProps) {
  const router = useRouter();
  const { videos, status, activeId, select, ensureLoaded, retry } = useVideos();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded, status]);

  const active = videos.find((v) => String(v.id) === activeId) ?? videos[0];

  const pick = (id: string) => {
    select(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-raised">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        {variant === 'page' && (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <PlaySquare className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="font-heading text-base font-bold text-ink">Rumia Videos</h2>
        {variant === 'drawer' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close videos"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {(status === 'idle' || status === 'loading') && (
          <div className={`flex ${FIRST_SCREEN} items-center justify-center`} role="status">
            <Loader2 className="h-6 w-6 animate-spin text-ink-muted" aria-label="Loading videos" />
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className={`flex ${FIRST_SCREEN} flex-col items-center justify-center gap-3 px-6 text-center`}>
            <p className="text-sm font-medium text-ink">Videos are unavailable right now.</p>
            <button type="button" onClick={retry} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && !active && <VideosEmptyState />}
        {status === 'ready' && active && (
          <>
            <div className={`flex ${FIRST_SCREEN} min-h-[28rem] flex-col gap-3 p-3`}>
              <div className="relative min-h-0 flex-1 [container-type:size]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    style={{
                      width: active.is_youtube_shorts
                        ? 'min(100cqw, calc(100cqh * 9 / 16))'
                        : 'min(100cqw, calc(100cqh * 16 / 9))',
                    }}
                  >
                    <VideoPlayer
                      key={String(active.id)}
                      youtubeId={active.youtube_id as string}
                      title={active.title}
                      portrait={!!active.is_youtube_shorts}
                    />
                  </div>
                </div>
              </div>
              <ActiveVideoDetails key={String(active.id)} listing={active} />
            </div>
            <NextVideos onPick={pick} />
          </>
        )}
      </div>
    </div>
  );
}
