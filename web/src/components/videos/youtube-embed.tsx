'use client';

import * as React from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';

interface YouTubeEmbedProps {
  youtubeId: string;
  isActive: boolean;
  isMuted: boolean;
  title?: string;
}

const THUMB_FALLBACKS = [
  (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/sddefault.jpg`,
  (id: string) => `https://img.youtube.com/vi/${id}/default.jpg`,
];

export function YouTubeEmbed({
  youtubeId,
  isActive,
  isMuted,
  title = 'Property video',
}: YouTubeEmbedProps) {
  const [hasError, setHasError] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [thumbIndex, setThumbIndex] = React.useState(0);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const thumbSrc = THUMB_FALLBACKS[thumbIndex](youtubeId);

  React.useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setIsPaused(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isActive, youtubeId]);

  const post = React.useCallback((func: string) => {
    if (!iframeRef.current) return;
    const win = iframeRef.current.contentWindow;
    if (!win) return;

    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      win.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*',
      );
      attempts += 1;
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 250);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!isActive) return;
    if (isPaused) post('pauseVideo');
    else post('playVideo');
  }, [isPaused, isActive, post]);

  const togglePause = React.useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const embedUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      autoplay: isActive && !isPaused ? '1' : '0',
      mute: !isActive || isMuted ? '1' : '0',
      controls: '0',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      loop: '1',
      playlist: youtubeId,
      enablejsapi: '1',
      origin: typeof window !== 'undefined' ? window.location.origin : 'https://rumia.co.ke',
      widget_referrer: typeof window !== 'undefined' ? window.location.origin : 'https://rumia.co.ke',
      iv_load_policy: '3',
      fs: '0',
      disablekb: '1',
      showinfo: '0',
    });
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }, [youtubeId, isActive, isMuted, isPaused]);

  if (!isActive || hasError) {
    return (
      <div className="absolute inset-0 bg-slate-900">
        <Image
          src={thumbSrc}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 430px"
          priority={false}
          onError={() => {
            setThumbIndex((prev) => {
              const next = prev + 1;
              if (next >= THUMB_FALLBACKS.length) {
                setHasError(true);
              }
              return next < THUMB_FALLBACKS.length ? next : prev;
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" onClick={togglePause}>
      <iframe
        ref={iframeRef}
        key={youtubeId}
        src={embedUrl}
        title={title}
        className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 border-0"
        style={{ pointerEvents: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onError={() => setHasError(true)}
      />
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xl">
            <Play className="h-7 w-7 ml-1" fill="currentColor" />
          </span>
        </div>
      )}
      {!isPaused && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-white">
            <Pause className="h-6 w-6" />
          </span>
        </div>
      )}
    </div>
  );
}
