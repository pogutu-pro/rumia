'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface LazyYouTubeProps {
  videoId: string;
  title?: string;
  isShort?: boolean;
}

export function LazyYouTube({ videoId, title = 'Video tour', isShort = false }: LazyYouTubeProps) {
  const [active, setActive] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const aspectClass = isShort ? 'aspect-[9/16]' : 'aspect-video';

  const sizeClass = isShort ? 'w-full lg:max-w-xs lg:mx-auto' : 'w-full';

  if (active) {
    return (
      <div className={`relative ${aspectClass} ${sizeClass} overflow-hidden rounded-2xl border border-slate-100 shadow-sm`}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setActive(true)}
      className={`relative ${aspectClass} ${sizeClass} overflow-hidden rounded-2xl border border-slate-100 shadow-sm group cursor-pointer block`}
      aria-label={`Play ${title}`}
    >
      <Image
        src={thumb}
        alt={`${title} thumbnail`}
        fill
        className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
        sizes="(max-width: 768px) 100vw, 66vw"
      />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
        <div className="bg-white/90 rounded-full p-4 shadow-lg">
          <Play className="h-8 w-8 text-slate-900 fill-slate-900" />
        </div>
      </div>
    </button>
  );
}
