'use client';

import * as React from 'react';
import Image from 'next/image';
import { AlertCircle, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { loadYouTubeAPI } from '@/lib/youtube-api-loader';
import { cn } from '@/lib/utils/cn';

interface VideoPlayerProps {
  youtubeId: string;
  title: string;
  /** The agent's link was a YouTube Shorts link: show a 9:16 frame. Otherwise the video is a normal 16:9 upload. */
  portrait: boolean;
}

type Phase = 'poster' | 'loading' | 'ready' | 'error';

const POSTERS = [
  (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Portrait-first player on top of the YouTube IFrame API.
 *
 * - The frame follows the listing: 9:16 for a YouTube Shorts link, 16:9 for a normal video link (the listing form sets
 *   `is_youtube_shorts` from the pasted URL). YouTube letterboxes inside the frame, so video is never stretched or cropped.
 * - Nothing loads from YouTube except the poster image until the person presses Play. The player is created on
 *   that press and destroyed when this component unmounts (switching video, closing the drawer, leaving the page),
 *   so only one video can ever be playing.
 * - The iframe ignores pointer events; every control here is ours and keyboard accessible.
 */
export function VideoPlayer({ youtubeId, title, portrait }: VideoPlayerProps) {
  const [phase, setPhase] = React.useState<Phase>('poster');
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [posterIndex, setPosterIndex] = React.useState(0);
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [canFullscreen, setCanFullscreen] = React.useState(false);

  const frameRef = React.useRef<HTMLDivElement>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YT.Player | null>(null);
  const aliveRef = React.useRef(true);
  const startTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    aliveRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanFullscreen(!!document.fullscreenEnabled);
    const onFs = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      aliveRef.current = false;
      document.removeEventListener('fullscreenchange', onFs);
      if (startTimer.current) window.clearTimeout(startTimer.current);
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
    };
  }, []);

  // Progress, only while a player exists.
  React.useEffect(() => {
    if (phase !== 'ready') return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrent(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {
        /* player not ready for queries yet */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = React.useCallback(async () => {
    if (phase === 'loading') return;
    setPhase('loading');
    try {
      const YTApi = await loadYouTubeAPI();
      if (!aliveRef.current || !mountRef.current) return;
      const target = document.createElement('div');
      mountRef.current.replaceChildren(target);
      playerRef.current = new YTApi.Player(target, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (!aliveRef.current) return;
            setPhase('ready');
            e.target.setVolume(100);
            setMuted(e.target.isMuted());
            setDuration(e.target.getDuration());
            e.target.playVideo();
            // If the browser still refuses to start (autoplay policy), fall back to showing a Play button.
            startTimer.current = window.setTimeout(() => {
              try {
                const state = e.target.getPlayerState();
                if (state !== YTApi.PlayerState.PLAYING && state !== YTApi.PlayerState.BUFFERING) setPlaying(false);
              } catch {
                /* ignore */
              }
            }, 2500);
          },
          onStateChange: (e) => {
            if (!aliveRef.current) return;
            setPlaying(e.data === YTApi.PlayerState.PLAYING || e.data === YTApi.PlayerState.BUFFERING);
          },
          onError: () => {
            if (aliveRef.current) setPhase('error');
          },
        },
      });
    } catch {
      if (aliveRef.current) setPhase('error');
    }
  }, [phase, youtubeId]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const ended = duration > 0 && current >= duration - 0.5;
      if (ended) p.seekTo(0, true);
      if (playing) p.pauseVideo();
      else p.playVideo();
    } catch {
      /* ignore */
    }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.isMuted()) {
        p.unMute();
        setMuted(false);
      } else {
        p.mute();
        setMuted(true);
      }
    } catch {
      /* ignore */
    }
  };

  const seek = (value: number) => {
    setCurrent(value);
    try {
      playerRef.current?.seekTo(value, true);
    } catch {
      /* ignore */
    }
  };

  const toggleFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const retry = () => {
    playerRef.current = null;
    setPhase('poster');
    setPlaying(false);
    void start();
  };

  const posterSrc = POSTERS[Math.min(posterIndex, POSTERS.length - 1)](youtubeId);
  const showPoster = phase === 'poster' || phase === 'loading';
  const ended = duration > 0 && current >= duration - 0.5 && !playing;

  return (
    <div
      ref={frameRef}
      className={cn(
        'group relative overflow-hidden bg-black',
        fullscreen ? 'h-full w-full' : cn(portrait ? 'aspect-[9/16]' : 'aspect-video', 'w-full rounded-2xl'),
      )}
    >
      {/* YouTube mounts here; pointer events off so its own chrome can never intercept input. */}
      <div
        ref={mountRef}
        className="pointer-events-none absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
        aria-hidden
      />

      {showPoster && (
        <div className="absolute inset-0">
          {!posterFailed ? (
            <Image
              src={posterSrc}
              alt=""
              fill
              sizes="(min-width: 1280px) 24rem, 100vw"
              className="object-cover"
              onError={() => {
                if (posterIndex + 1 < POSTERS.length) setPosterIndex(posterIndex + 1);
                else setPosterFailed(true);
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-subtle" />
          )}
          <button
            type="button"
            onClick={() => void start()}
            disabled={phase === 'loading'}
            aria-label={phase === 'loading' ? `Loading ${title}` : `Play ${title}`}
            className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-ink shadow-lg">
              {phase === 'loading' ? (
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
              )}
            </span>
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-raised p-6 text-center">
          <AlertCircle className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm font-medium text-ink">This video could not be played.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink"
            >
              Watch on YouTube
            </a>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : ended ? 'Replay' : 'Play'}
            className="absolute inset-0 z-[1] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            {!playing && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-ink shadow-lg">
                {ended ? <RotateCcw className="h-7 w-7" aria-hidden /> : <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />}
              </span>
            )}
          </button>

          <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-white">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.5}
              value={Math.min(current, Math.max(duration, 1))}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
              aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
              className="h-1 w-full cursor-pointer accent-white"
            />
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <span className="text-xs tabular-nums">
                {formatTime(current)} / {formatTime(duration)}
              </span>
              <span className="ml-auto" />
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={muted}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              {canFullscreen && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
