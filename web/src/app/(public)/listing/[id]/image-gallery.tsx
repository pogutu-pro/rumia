'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { LayoutGrid, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { GalleryImage, GalleryViewMode } from '@/components/gallery/gallery-types';
import { GalleryMasonryGrid } from '@/components/gallery/gallery-masonry-grid';
import { GalleryCarouselViewer } from '@/components/gallery/gallery-carousel-viewer';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface ImageGalleryProps {
  images: (string | GalleryImage)[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const fallbackImage =
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1200';

  // Normalize image objects
  const displayImages: GalleryImage[] =
    images && images.length > 0
      ? images.map((img, idx) => {
          if (typeof img === 'string') {
            return {
              id: `img-${idx}`,
              r2_url: img,
              category: 'Room',
              alt: `Hostel photo ${idx + 1}`,
            };
          }
          return {
            id: img.id || `img-${idx}`,
            r2_url: img.r2_url || (img as any).url || fallbackImage,
            category: img.category || 'Room',
            blur_data_url: img.blur_data_url || undefined,
            width: img.width,
            height: img.height,
            alt: img.alt || `Hostel photo ${idx + 1}`,
          };
        })
      : [
          {
            id: 'fallback-0',
            r2_url: fallbackImage,
            category: 'Room',
            alt: 'Hostel main view',
          },
        ];

  // Gallery state
  const [viewMode, setViewMode] = useState<GalleryViewMode | null>(null); // null means closed
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Manage body scroll lock
  useScrollLock(viewMode !== null);

  // Intercept mobile Back button / Android back gesture to close gallery instead of leaving page
  useEffect(() => {
    const handlePopState = () => {
      setViewMode(null);
    };

    if (viewMode !== null) {
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [viewMode]);

  // Open gallery at a specific index
  const openGalleryAt = (index: number, mode: GalleryViewMode = 'carousel') => {
    if (viewMode === null) {
      // Push history state so mobile Back gesture/button closes gallery overlay instead of navigating away
      window.history.pushState({ galleryOpen: true }, '', '#gallery');
    }
    setActivePhotoIndex(index);
    setViewMode(mode);
  };

  const closeGallery = () => {
    if (viewMode !== null) {
      setViewMode(null);
      if (typeof window !== 'undefined' && (window.location.hash === '#gallery' || window.history.state?.galleryOpen)) {
        window.history.back();
      }
    }
  };

  return (
    <div className="relative w-full">
      {/* ── Mobile View Photo Hero ───────────────────────────────────────── */}
      <div
        className="md:hidden relative aspect-[4/3] w-full overflow-hidden bg-slate-100 rounded-2xl border border-slate-100 shadow-xs cursor-pointer group"
        onClick={() => openGalleryAt(0, 'grid')}
      >
        <Image
          src={displayImages[0]?.r2_url}
          alt={displayImages[0]?.alt || 'Hostel main view'}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          sizes="100vw"
          priority
          placeholder={
            displayImages[0]?.blur_data_url ? 'blur' : undefined
          }
          blurDataURL={displayImages[0]?.blur_data_url || undefined}
        />

        {/* Mobile Badges: Count 1/X on bottom left, 'See all photos' button on bottom right */}
        {displayImages.length > 1 && (
          <>
            {/* Bottom Left: Photo count 1 / X */}
            <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white tracking-wider shadow-sm z-10">
              1 / {displayImages.length}
            </div>

            {/* Bottom Right: Clean white button 'See all photos' */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openGalleryAt(0, 'grid');
              }}
              className="absolute bottom-4 right-4 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs py-1.5 px-3.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 transition-all cursor-pointer z-20"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-slate-700" />
              <span>See all photos</span>
            </button>
          </>
        )}
      </div>

      {/* ── Desktop Airbnb-Style 5-Grid Layout ───────────────────────────── */}
      <div className="hidden md:grid grid-cols-4 gap-2 aspect-[21/9] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative group">
        {displayImages.length === 1 ? (
          <div
            className="col-span-4 h-full relative overflow-hidden"
            onClick={() => openGalleryAt(0, 'carousel')}
          >
            <Image
              src={displayImages[0].r2_url}
              alt="Property display"
              fill
              className="object-cover hover:scale-[1.01] transition-transform duration-500 cursor-pointer"
              sizes="100vw"
              priority
              placeholder={displayImages[0]?.blur_data_url ? 'blur' : undefined}
              blurDataURL={displayImages[0]?.blur_data_url || undefined}
            />
          </div>
        ) : displayImages.length === 2 ? (
          <>
            <div
              className="col-span-2 h-full relative overflow-hidden"
              onClick={() => openGalleryAt(0, 'carousel')}
            >
              <Image
                src={displayImages[0].r2_url}
                alt="Property display 1"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                sizes="50vw"
                priority
                placeholder={displayImages[0]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[0]?.blur_data_url || undefined}
              />
            </div>
            <div
              className="col-span-2 h-full relative overflow-hidden"
              onClick={() => openGalleryAt(1, 'carousel')}
            >
              <Image
                src={displayImages[1].r2_url}
                alt="Property display 2"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                sizes="50vw"
                placeholder={displayImages[1]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[1]?.blur_data_url || undefined}
              />
            </div>
          </>
        ) : displayImages.length === 3 ? (
          <>
            <div
              className="col-span-2 row-span-2 h-full relative overflow-hidden"
              onClick={() => openGalleryAt(0, 'carousel')}
            >
              <Image
                src={displayImages[0].r2_url}
                alt="Property display 1"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                sizes="50vw"
                priority
                placeholder={displayImages[0]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[0]?.blur_data_url || undefined}
              />
            </div>
            <div
              className="col-span-2 h-full relative overflow-hidden"
              onClick={() => openGalleryAt(1, 'carousel')}
            >
              <Image
                src={displayImages[1].r2_url}
                alt="Property display 2"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                sizes="50vw"
                placeholder={displayImages[1]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[1]?.blur_data_url || undefined}
              />
            </div>
            <div
              className="col-span-2 h-full relative overflow-hidden"
              onClick={() => openGalleryAt(2, 'carousel')}
            >
              <Image
                src={displayImages[2].r2_url}
                alt="Property display 3"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                sizes="50vw"
                placeholder={displayImages[2]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[2]?.blur_data_url || undefined}
              />
            </div>
          </>
        ) : (
          <>
            {/* Left Main Hero Image (#0) */}
            <div
              className="col-span-2 row-span-2 h-full relative overflow-hidden cursor-pointer"
              onClick={() => openGalleryAt(0, 'carousel')}
            >
              <Image
                src={displayImages[0].r2_url}
                alt="Property main display"
                fill
                className="object-cover hover:scale-[1.01] transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                placeholder={displayImages[0]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[0]?.blur_data_url || undefined}
              />
            </div>

            {/* Top Right Photos (#1, #2) */}
            <div
              className="col-span-1 h-full relative overflow-hidden cursor-pointer"
              onClick={() => openGalleryAt(1, 'carousel')}
            >
              <Image
                src={displayImages[1]?.r2_url || fallbackImage}
                alt="Property detail 1"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
                placeholder={displayImages[1]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[1]?.blur_data_url || undefined}
              />
            </div>

            <div
              className="col-span-1 h-full relative overflow-hidden cursor-pointer"
              onClick={() => openGalleryAt(2, 'carousel')}
            >
              <Image
                src={displayImages[2]?.r2_url || fallbackImage}
                alt="Property detail 2"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
                placeholder={displayImages[2]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[2]?.blur_data_url || undefined}
              />
            </div>

            {/* Bottom Right Photos (#3, #4) */}
            <div
              className="col-span-1 h-full relative overflow-hidden cursor-pointer"
              onClick={() => openGalleryAt(3, 'carousel')}
            >
              <Image
                src={displayImages[3]?.r2_url || fallbackImage}
                alt="Property detail 3"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
                placeholder={displayImages[3]?.blur_data_url ? 'blur' : undefined}
                blurDataURL={displayImages[3]?.blur_data_url || undefined}
              />
            </div>

            <div
              className="col-span-1 h-full relative overflow-hidden cursor-pointer"
              onClick={() => openGalleryAt(4 % displayImages.length, 'carousel')}
            >
              <Image
                src={displayImages[4]?.r2_url || displayImages[0].r2_url}
                alt="Property detail 4"
                fill
                className="object-cover hover:scale-[1.02] transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
                placeholder={
                  (displayImages[4] || displayImages[0])?.blur_data_url
                    ? 'blur'
                    : undefined
                }
                blurDataURL={
                  (displayImages[4] || displayImages[0])?.blur_data_url ||
                  undefined
                }
              />
            </div>
          </>
        )}

        {/* Show all photos floating button */}
        {displayImages.length > 1 && (
          <button
            type="button"
            onClick={() => openGalleryAt(0, 'grid')}
            className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-slate-900 font-bold text-xs py-2 px-4 rounded-xl border border-slate-200 shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer z-20"
          >
            <LayoutGrid className="h-4 w-4 text-emerald-600" />
            <span>Show all photos</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-extrabold">
              {displayImages.length}
            </span>
          </button>
        )}
      </div>

      {/* ── Fullscreen Overlay System (Grid or Carousel) ───────────────────── */}
      {viewMode === 'grid' && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col text-slate-900 animate-in fade-in duration-200">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-slate-900 font-extrabold text-lg tracking-tight">
                Photo Gallery
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {displayImages.length} total photos available
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('carousel')}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
              >
                Slideshow Mode
              </button>
              <button
                type="button"
                onClick={closeGallery}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-full transition-colors cursor-pointer"
                aria-label="Close photo gallery"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Masonry Layout */}
          <GalleryMasonryGrid
            images={displayImages}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            onImageClick={(idx) => openGalleryAt(idx, 'carousel')}
            onOpenCarousel={(idx = 0) => openGalleryAt(idx, 'carousel')}
            onClose={closeGallery}
          />
        </div>
      )}

      {viewMode === 'carousel' && (
        <GalleryCarouselViewer
          images={displayImages}
          currentIndex={activePhotoIndex}
          onNavigate={setActivePhotoIndex}
          onSwitchToGrid={() => setViewMode('grid')}
          onClose={closeGallery}
        />
      )}
    </div>
  );
}
