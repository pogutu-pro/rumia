'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJiIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxLjUiLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTFlZWYwIiBmaWx0ZXI9InVybCgjYikiLz48L3N2Zz4=';

type VideoProps = {
  url: string;
  title?: string;
  thumbnail?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  priority?: boolean;
  className?: string;
};

export default function RumiVideo({
  url,
  title = 'Watch video',
  thumbnail,
  autoplay = false,
  muted = false,
  loop = false,
  priority = false,
  className,
}: VideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Intersection Observer for autoplay - starts immediately when in view
  useEffect(() => {
    if (!containerRef.current || !isMounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Small delay to ensure iframe is ready
            setTimeout(() => {
              setIsPlaying(true);
            }, 100);
          }
        });
      },
      {
        threshold: 0.1, // Video must be 10% visible to start
      }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isMounted]);

  // Extract YouTube ID
  const youtubeId = url.match(
    /(?:youtube\.com.*(?:v=|embed\/|shorts\/)|youtu\.be\/)([^&#?]+)/i,
  )?.[1];

  // Generate embed URL
  const mutedParam = muted ? '&mute=1' : '';
  const loopParam = loop && youtubeId ? `&loop=1&playlist=${youtubeId}` : '';
  
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1${mutedParam}${loopParam}`
    : url.includes('vimeo.com')
      ? url.replace('vimeo.com', 'player.vimeo.com/video') + `?autoplay=1${muted ? '&muted=1' : ''}${loop ? '&loop=1' : ''}`
      : url;

  // Final thumbnail (priority: prop → YouTube → fallback)
  const finalThumbnail =
    thumbnail ||
    (youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
      : '/images/fallback-video.jpg');

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  if (!url) return null;
  
  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <div
        className={cn(
          'relative w-full aspect-video rounded-2xl overflow-hidden shadow-xl bg-gray-900',
          className,
        )}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-video rounded-xl overflow-hidden shadow-sm bg-gray-950',
        className,
      )}
    >
      {isPlaying ? (
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full rounded-2xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-950">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-tight">Loading...</div>
        </div>
      )}
    </div>
  );
}

export function RumiHeroVideo(props: Omit<VideoProps, 'priority'>) {
  return <RumiVideo {...props} priority className="rounded-xl shadow-sm border border-border" />;
}
