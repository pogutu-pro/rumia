'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type VideoProps = {
  url: string;
  title?: string;
  thumbnail?: string;
  muted?: boolean;
  loop?: boolean;
  priority?: boolean;
  className?: string;
};

export default function RumiVideo({
  url,
  title = 'Watch video',
  thumbnail,
  muted = false,
  loop = false,
  priority = false,
  className,
}: VideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Extract YouTube ID
  const youtubeId = url.match(
    /(?:youtube\.com.*(?:v=|embed\/|shorts\/)|youtu\.be\/)([^&#?]+)/i,
  )?.[1];

  const isShort = youtubeId ? /\/shorts\//i.test(url) : false;

  // Generate embed URL
  const mutedParam = muted ? '&mute=1' : '';
  const loopParam = loop && youtubeId ? `&loop=1&playlist=${youtubeId}` : '';
  
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1${mutedParam}${loopParam}`
    : url.includes('vimeo.com')
      ? url.replace('vimeo.com', 'player.vimeo.com/video') + `?${muted ? 'muted=1&' : ''}${loop ? 'loop=1&' : ''}`
      : url;

  // Final thumbnail (priority: prop → YouTube → fallback)
  const finalThumbnail =
    thumbnail ||
    (youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
      : '/images/fallback-video.jpg');

  const handlePlay = () => {
    setIsPlaying(true);
  };

  if (!url) return null;
  
  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <div
        className={cn(
          `relative w-full ${isShort ? 'aspect-[9/16] max-w-[280px]' : 'aspect-video'} rounded-2xl overflow-hidden shadow-xl bg-gray-900`,
          className,
        )}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        `relative w-full ${isShort ? 'aspect-[9/16] max-w-[280px]' : 'aspect-video'} rounded-xl overflow-hidden shadow-sm bg-gray-950`,
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
        <button
          onClick={handlePlay}
          className="w-full h-full relative group cursor-pointer"
          aria-label={`Play ${title}`}
        >
          <Image
            src={finalThumbnail}
            alt={`${title} thumbnail`}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 66vw"
            priority={priority}
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
            <div className="bg-white/90 rounded-full p-4 shadow-lg">
              <Play className="h-8 w-8 text-slate-900 fill-slate-900" />
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

export function RumiHeroVideo(props: Omit<VideoProps, 'priority'>) {
  return <RumiVideo {...props} priority className="rounded-xl shadow-sm border border-border" />;
}
