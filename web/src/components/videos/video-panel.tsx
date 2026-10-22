'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, ExternalLink, Loader2, MapPin, MessageCircle, PlaySquare, X } from 'lucide-react';
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
const FIRST_SCREEN = 'h-[calc(100dvh-var(--shell-header-h)-var(--bottom-nav-h)-3rem)]';
/** The videos page has no panel header: the video gets the whole screen between the app bars, like TikTok. */
const STAGE = 'h-[calc(100dvh-var(--shell-header-h)-var(--bottom-nav-h))]';

/**
 * The playing video's listing. `stacked` (the desktop drawer) lists it under the video; `overlay` (the videos page)
 * lays it over the video like TikTok: actions down the right edge, details bottom-left, so phone-shot videos get the
 * screen. The overlay sits above the player's own control bar and only its buttons take taps, so tapping the video
 * still plays and pauses it.
 */
function ActiveVideoDetails({ listing, layout }: { listing: Listing; layout: 'stacked' | 'overlay' }) {
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

  const contactModal = canContact && (
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
  );

  if (layout === 'overlay') {
    const label = 'text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]';
    return (
      <>
        {/* Bottom shade so white text reads on any video; it stops above the player's control bar. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-64 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

        <div className="pointer-events-none absolute bottom-16 right-2 z-[4] flex flex-col items-center gap-4 [@media(max-height:640px)]:gap-2">
          <div className="flex flex-col items-center gap-1">
            <SaveButton listingId={String(listing.id)} variant="icon" />
            <span className={label}>Save</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ShareListingButton
              listing={{ name: listing.title, area: place || 'Nyeri', url: shareUrl, imageUrl: firstImage?.r2_url }}
              variant="icon"
            />
            <span className={label}>Share</span>
          </div>
          {canContact && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                aria-label="Contact about this place"
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
              </button>
              <span className={label}>Contact</span>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-16 left-3 right-16 z-[4] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          <h2 className="line-clamp-2 text-base font-semibold leading-snug [@media(max-height:640px)]:line-clamp-1 [@media(max-height:640px)]:text-sm">{listing.title}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-white/90">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {categoryLabel(listing)}
              {place ? ` · ${place}` : ''}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-lg font-bold [@media(max-height:640px)]:mt-0.5 [@media(max-height:640px)]:text-base">
            {formatCurrency(listing.price)}
            <span className="text-xs font-medium text-white/85">/ {pricePeriodLabel(listing)}</span>
            {listing.is_full && (
              <span className="ml-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-destructive [text-shadow:none]">
                Fully occupied
              </span>
            )}
          </p>
          <Link
            href={href}
            className="pointer-events-auto mt-2 inline-flex h-9 items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold [@media(max-height:640px)]:mt-1.5 [@media(max-height:640px)]:h-8 [@media(max-height:640px)]:px-3 [@media(max-height:640px)]:text-xs text-ink shadow-md [text-shadow:none] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            View property <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {contactModal}
      </>
    );
  }

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
      {contactModal}
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
  const immersive = variant === 'page';
  const screen = immersive ? STAGE : FIRST_SCREEN;
  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/'));

  const pick = (id: string) => {
    select(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${immersive ? 'bg-black' : 'bg-raised'}`}>
      {immersive && <h2 className="sr-only">Rumia Videos</h2>}
      <div className={immersive ? 'hidden' : 'flex h-12 shrink-0 items-center gap-2 border-b border-line px-3'}>
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

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {immersive && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="absolute left-2 top-2 z-[5] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {(status === 'idle' || status === 'loading') && (
          <div className={`flex ${screen} items-center justify-center`} role="status">
            <Loader2 className={`h-6 w-6 animate-spin ${immersive ? 'text-white/70' : 'text-ink-muted'}`} aria-label="Loading videos" />
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className={`flex ${screen} flex-col items-center justify-center gap-3 px-6 text-center`}>
            <p className={`text-sm font-medium ${immersive ? 'text-white' : 'text-ink'}`}>Videos are unavailable right now.</p>
            <button type="button" onClick={retry} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && !active && <VideosEmptyState />}
        {status === 'ready' && active && immersive && (
          <>
            <div className={`relative ${STAGE} min-h-[26rem] [container-type:size]`}>
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
                    rounded={false}
                  />
                </div>
              </div>
              <ActiveVideoDetails key={String(active.id)} listing={active} layout="overlay" />
            </div>
            <div className="bg-raised">
              <NextVideos onPick={pick} />
            </div>
          </>
        )}
        {status === 'ready' && active && !immersive && (
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
              <ActiveVideoDetails key={String(active.id)} listing={active} layout="stacked" />
            </div>
            <NextVideos onPick={pick} />
          </>
        )}
      </div>
    </div>
  );
}
