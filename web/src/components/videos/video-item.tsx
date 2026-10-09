'use client';

import { listingPath } from '@/lib/utils/listing-path';
import * as React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Volume2,
  VolumeX,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { YouTubeEmbed } from './youtube-embed';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';
import { useWishlistStore } from '@/stores/wishlist-store';
import type { Listing } from '@/types';

interface VideoItemProps {
  listing: Listing;
  index: number;
  activeIndex: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

function getPropertyTypeBadge(type: string | undefined): {
  label: string;
  className: string;
} {
  switch (type) {
    case 'short_stay':
      return { label: 'Short Stay', className: 'bg-amber-500 text-white' };
    case 'apartment':
      return { label: 'Apartment', className: 'bg-sky-600 text-white' };
    default:
      return { label: 'Hostel', className: 'bg-primary text-primary-foreground' };
  }
}

function getPriceLabel(type: string | undefined, price: number): string {
  const formatted = `KES ${price.toLocaleString()}`;
  if (type === 'short_stay') return `${formatted}/night`;
  return `${formatted}/mo`;
}

function getListingHref(listing: Listing): string {
  if (listing.property_type === 'short_stay') {
    return `/bnb/${listing.id}`;
  }
  if (listing.slug && listing.county && listing.area) {
    return listingPath(listing);
  }
  if (listing.slug && listing.area) {
    return `/hostels/nyeri/${listing.area}/${listing.slug}`;
  }
  return `/listing/${listing.id}`;
}

function getWhatsAppUrl(listing: Listing): string | null {
  const phone =
    (listing.agent as any)?.whatsapp ||
    (listing.agent as any)?.phone ||
    listing.landlord_phone;
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  const international = clean.startsWith('0') ? `254${clean.slice(1)}` : clean;
  const msg = encodeURIComponent(
    `Hi, I saw ${listing.title} on Rumia. Is it still available?`,
  );
  return `https://wa.me/${international}?text=${msg}`;
}

export const VideoItem = React.memo(function VideoItem({
  listing,
  index,
  activeIndex,
  isMuted,
  onToggleMute,
}: VideoItemProps) {
  const isActive = index === activeIndex;
  // Window: active ± 1 get an iframe, everything else gets thumbnail
  const isInWindow = Math.abs(index - activeIndex) <= 1;
  const badge = getPropertyTypeBadge(listing.property_type);
  const priceLabel = getPriceLabel(listing.property_type, listing.price);
  const href = getListingHref(listing);
  const whatsappUrl = getWhatsAppUrl(listing);
  const listingIdStr = String(listing.id);

  const isSaved = useWishlistStore((s) => s.saved[listingIdStr] ?? false);
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;

  return (
    <div
      data-index={index}
      className="relative h-full w-full flex-shrink-0 snap-start overflow-hidden bg-card md:rounded-2xl md:shadow-xl md:border md:border-border"
      style={{ height: '100%' }}
    >
      {/* ── YouTube Player / Thumbnail ─────────────────────────────────── */}
      <div className="absolute inset-0">
        {listing.youtube_id ? (
          <YouTubeEmbed
            youtubeId={listing.youtube_id}
            isActive={isInWindow ? isActive : false}
            isMuted={isMuted}
            title={listing.title}
            priority={index < 2}
            onToggleMute={onToggleMute}
          />
        ) : (
          /* No video — show placeholder */
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-sm">No video</span>
          </div>
        )}
      </div>

      {/* ── Gradient overlay — lighter, classier ──────────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '55%',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.25) 40%, transparent 100%)',
        }}
      />

      {/* ── Mute / Unmute toggle — frosted glass ─────────────────────── */}
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="absolute top-[calc(1rem_+_env(safe-area-inset-top))] right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm backdrop-blur-xl border border-white/50 transition-colors hover:bg-white/95"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      {/* ── Right-side action column — frosted glass buttons ──────────── */}
      <div className="absolute right-3 bottom-36 z-20 flex flex-col items-center gap-4 [@media(max-height:700px)]:bottom-24 [@media(max-height:700px)]:gap-3 md:bottom-40">
        {/* Save */}
        <div className="flex flex-col items-center gap-1">
          <SaveButton
            listingId={listingIdStr}
            variant="icon"
            className={
              isSaved
                ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 hover:text-white'
                : 'border-white/50 bg-white/80 text-slate-700 hover:bg-white/95 hover:text-slate-900 backdrop-blur-xl shadow-sm'
            }
          />
          <span
            className={`text-[10px] font-semibold ${isSaved ? 'text-red-400' : 'text-white drop-shadow-sm'}`}
          >
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <ShareListingButton
            listing={{
              name: listing.title,
              area: (listing as any).area || listing.location || 'Hostel Area',
              url: shareUrl,
              imageUrl:
                (listing as any).images?.[0]?.r2_url ||
                (listing as any).image_url,
            }}
            variant="icon"
            className="h-11 w-11 rounded-full border border-white/50 bg-white/80 text-slate-700 hover:bg-white/95 hover:text-slate-900 backdrop-blur-xl shadow-sm"
          />
          <span className="text-[10px] font-semibold text-white drop-shadow-sm">
            Share
          </span>
        </div>

        {/* WhatsApp Contact */}
        {whatsappUrl && (
          <div className="flex flex-col items-center gap-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Contact on WhatsApp"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/80 text-slate-700 backdrop-blur-xl shadow-sm transition-colors hover:bg-white/95"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
            <span className="text-[10px] font-semibold text-white drop-shadow-sm">
              Contact
            </span>
          </div>
        )}

        {/* View Listing */}
        <div className="flex flex-col items-center gap-1">
          <Link
            href={href}
            aria-label="View listing"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/80 text-slate-700 backdrop-blur-xl shadow-sm transition-colors hover:bg-white/95"
          >
            <ExternalLink className="h-5 w-5" />
          </Link>
          <span className="text-[10px] font-semibold text-white drop-shadow-sm">
            View
          </span>
        </div>
      </div>

      {/* ── Property overlay (bottom) ─────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 pr-20 [@media(max-height:700px)]:pb-4 md:pb-8">
        {/* Tap for sound — Instagram/Reels style */}
        {isActive && isMuted && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label="Tap for sound"
            className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/95"
          >
            <VolumeX className="h-3.5 w-3.5" />
            Tap for sound
          </button>
        )}

        {/* Property type badge */}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide mb-2 ${badge.className}`}
        >
          {badge.label}
        </span>

        {/* Fully occupied badge */}
        {listing.is_full && (
          <span className="ml-2 inline-flex items-center rounded-full bg-destructive px-2.5 py-0.5 text-[11px] font-bold text-destructive-foreground">
            Fully Occupied
          </span>
        )}

        {/* Title */}
        <h2 className="text-white font-bold text-lg leading-tight line-clamp-2 mb-1 drop-shadow-sm">
          {listing.title}
        </h2>

        {/* Price */}
        <p className="text-emerald-400 font-extrabold text-base mb-1 drop-shadow-sm">
          {priceLabel}
        </p>

        {/* Location */}
        <div className="flex items-center gap-1 text-white/80 text-xs font-medium drop-shadow-sm">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {listing.area ? `${listing.area}` : listing.location}
            {listing.area &&
            listing.location &&
            listing.area !== listing.location
              ? ` · ${listing.location}`
              : ''}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          View Property
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
});
