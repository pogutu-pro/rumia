'use client';

import * as React from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { loadYouTubeAPI } from '@/lib/youtube-api-loader';

interface YouTubeEmbedProps {
  youtubeId: string;
  isActive: boolean;
  isMuted: boolean;
  title?: string;
  priority?: boolean;
}

const THUMB_FALLBACKS = [
  (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/sddefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/default.jpg`,
];

/**
 * YouTubeEmbed — Premium video player using the YouTube IFrame Player API.
 *
 * Key performance optimisations:
 * 1. Shows a hi-res thumbnail instantly (no iframe until API is ready)
 * 2. Loads the YouTube IFrame API script once via singleton loader
 * 3. Creates YT.Player programmatically — no iframe URL changes or re-mounts
 * 4. Fades the thumbnail out only after the player fires PLAYING state
 * 5. Play/pause/mute controlled via direct API calls (no URL recalculation)
 */
export function YouTubeEmbed({
  youtubeId,
  isActive,
  isMuted,
  title = 'Property video',
  priority = false,
}: YouTubeEmbedProps) {
  const [thumbIndex, setThumbIndex] = React.useState(0);
  const [thumbError, setThumbError] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [apiReady, setApiReady] = React.useState(false);

  const playerRef = React.useRef<YT.Player | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoIdRef = React.useRef(youtubeId);

  const thumbSrc = THUMB_FALLBACKS[Math.min(thumbIndex, THUMB_FALLBACKS.length - 1)](youtubeId);

  // ── Load the YT API once ───────────────────────────────────────────
  React.useEffect(() => {
    loadYouTubeAPI().then(() => setApiReady(true));
  }, []);

  // ── Create / destroy the YT.Player ─────────────────────────────────
  React.useEffect(() => {
    if (!apiReady || !isActive || !containerRef.current) return;

    // If the video ID changed, destroy the old player
    if (playerRef.current && videoIdRef.current !== youtubeId) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
    videoIdRef.current = youtubeId;

    // Already have a player for this video — just play
    if (playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch { /* noop */ }
      return;
    }

    // Need a target div for YT.Player to replace
    let targetDiv = containerRef.current.querySelector<HTMLDivElement>('.yt-player-target');
    if (!targetDiv) {
      targetDiv = document.createElement('div');
      targetDiv.className = 'yt-player-target';
      containerRef.current.appendChild(targetDiv);
    }

    const player = new window.YT.Player(targetDiv, {
      videoId: youtubeId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        loop: 1,
        playlist: youtubeId,
        enablejsapi: 1,
        iv_load_policy: 3,
        fs: 0,
        disablekb: 1,
        mute: isMuted ? 1 : 0,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        showinfo: 0,
      },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          if (isMuted) e.target.mute();
          else e.target.unMute();
          e.target.playVideo();
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setIsPaused(false);
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            setIsPaused(true);
          }
        },
      },
    });

    playerRef.current = player;

    return () => {
      // Don't destroy on cleanup — we reuse when scrolling back
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, isActive, youtubeId]);

  // ── Stop when scrolled away ────────────────────────────────────────
  React.useEffect(() => {
    if (!isActive && playerRef.current) {
      try {
        playerRef.current.pauseVideo();
      } catch { /* noop */ }
    }
  }, [isActive]);

  // ── Sync mute state via API ────────────────────────────────────────
  React.useEffect(() => {
    if (!playerRef.current || !isActive) return;
    try {
      if (isMuted) playerRef.current.mute();
      else playerRef.current.unMute();
    } catch { /* noop */ }
  }, [isMuted, isActive]);

  // ── Pause / resume via API ─────────────────────────────────────────
  const togglePause = React.useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPaused) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch { /* noop */ }
  }, [isPaused]);

  // ── Thumbnail (inactive state or loading cover) ────────────────────
  const showThumbnail = !isActive || !isPlaying;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-muted"
      onClick={isActive ? togglePause : undefined}
    >
      {/* YT.Player mount point */}
      <div
        ref={containerRef}
        className="absolute inset-0 [&>div]:absolute [&>div]:inset-0 [&>div>iframe]:absolute [&>div>iframe]:inset-0 [&>div>iframe]:h-full [&>div>iframe]:w-full [&>div>iframe]:border-0"
      />

      {/* Thumbnail cover — shown while loading or inactive */}
      <div
        className={[
          'absolute inset-0 z-[2] transition-opacity duration-300',
          showThumbnail ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        {!thumbError ? (
          <Image
            src={thumbSrc}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 480px"
            priority={priority}
            onError={() => {
              setThumbIndex((prev) => {
                const next = prev + 1;
                if (next >= THUMB_FALLBACKS.length) setThumbError(true);
                return next < THUMB_FALLBACKS.length ? next : prev;
              });
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-sm">Video unavailable</span>
          </div>
        )}

        {/* Play indicator on thumbnail when inactive */}
        {!isActive && !thumbError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <Play className="h-6 w-6 ml-0.5 text-slate-900 fill-slate-900" />
            </span>
          </div>
        )}
      </div>

      {/* Pause / Play overlay */}
      {isActive && isPaused && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-black/15 pointer-events-none">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl">
            <Play className="h-7 w-7 ml-1" fill="currentColor" />
          </span>
        </div>
      )}
      {isActive && !isPaused && isPlaying && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center opacity-0 pointer-events-none">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/30 text-white">
            <Pause className="h-6 w-6" />
          </span>
        </div>
      )}
    </div>
  );
}
