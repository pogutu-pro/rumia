'use client';

import * as React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { loadYouTubeAPI } from '@/lib/youtube-api-loader';

interface YouTubeEmbedProps {
  youtubeId: string;
  isActive: boolean;
  isMuted: boolean;
  title?: string;
  priority?: boolean;
  onToggleMute: () => void;
}

const THUMB_FALLBACKS = [
  (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/sddefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/default.jpg`,
];

/**
 * YouTubeEmbed — native-feeling Rumia video player on top of YouTube.
 *
 * - The YouTube iframe is rendered with pointer-events disabled so YouTube's
 *   own chrome (Shorts speaker icon, "Shorts"/title bar, mic, logo, controls)
 *   can NEVER appear or intercept taps — it feels like it comes from Rumia.
 * - Autoplays muted by default; tapping the video toggles mute/unmute.
 * - Player audio volume is pinned to 100 so the device/hardware volume keys
 *   fully control loudness.
 * - Thumbnail covers the player until PLAYING fires (no black screen).
 */
export function YouTubeEmbed({
  youtubeId,
  isActive,
  isMuted,
  title = 'Property video',
  priority = false,
  onToggleMute,
}: YouTubeEmbedProps) {
  const [thumbIndex, setThumbIndex] = React.useState(0);
  const [thumbError, setThumbError] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [apiState, setApiState] = React.useState<'loading' | 'ready' | 'failed'>('loading');

  const playerRef = React.useRef<YT.Player | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoIdRef = React.useRef(youtubeId);

  const useFallback = apiState === 'failed';
  const thumbSrc = THUMB_FALLBACKS[Math.min(thumbIndex, THUMB_FALLBACKS.length - 1)](youtubeId);

  // ── Load the YT API once (singleton) ───────────────────────────────
  React.useEffect(() => {
    let active = true;
    loadYouTubeAPI()
      .then(() => {
        if (active) setApiState('ready');
      })
      .catch(() => {
        if (active) setApiState('failed');
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Create / reuse the YT.Player for the active video ──────────────
  React.useEffect(() => {
    if (apiState !== 'ready' || !isActive || !containerRef.current) return;

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
          e.target.setVolume(100);
          if (isMuted) e.target.mute();
          else e.target.unMute();
          e.target.playVideo();
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          }
        },
      },
    });

    playerRef.current = player;

    return () => {
      // Don't destroy on cleanup — we reuse when scrolling back
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiState, isActive, youtubeId]);

  // ── Stop when scrolled away ────────────────────────────────────────
  React.useEffect(() => {
    if (!isActive && playerRef.current) {
      try {
        playerRef.current.pauseVideo();
      } catch { /* noop */ }
    }
  }, [isActive]);

  // ── Sync mute state + pin volume to 100 via API ────────────────────
  React.useEffect(() => {
    if (!playerRef.current || !isActive || useFallback) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        playerRef.current.playVideo();
      }
    } catch { /* noop */ }
  }, [isMuted, isActive, useFallback]);

  // ── Thumbnail cover (inactive, or until the player starts) ─────────
  const showThumbnail = !isActive || (!isPlaying && !useFallback);

  const fallbackSrc = React.useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: isMuted ? '1' : '0',
      controls: '0',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      loop: '1',
      playlist: youtubeId,
      iv_load_policy: '3',
      fs: '0',
      disablekb: '1',
      origin: typeof window !== 'undefined' ? window.location.origin : 'https://rumia.co.ke',
    });
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }, [youtubeId, isMuted]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-muted"
      onClick={isActive ? onToggleMute : undefined}
    >
      {/* Primary player mount point — pointer-events off so YouTube chrome never shows */}
      {!useFallback && (
        <div
          ref={containerRef}
          className="pointer-events-none absolute inset-0 [&>div]:absolute [&>div]:inset-0 [&>div>iframe]:absolute [&>div>iframe]:inset-0 [&>div>iframe]:h-full [&>div>iframe]:w-full [&>div>iframe]:border-0"
        />
      )}

      {/* Resilience fallback — only when the IFrame API is fully blocked */}
      {useFallback && isActive && (
        <iframe
          key={String(isMuted)}
          src={fallbackSrc}
          title={title}
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}

      {/* Thumbnail cover — shown while loading or inactive */}
      <div
        className={[
          'absolute inset-0 z-[2] transition-opacity duration-200',
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
    </div>
  );
}