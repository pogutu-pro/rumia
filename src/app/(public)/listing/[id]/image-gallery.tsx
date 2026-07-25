'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { LayoutGrid, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { GalleryImage, GalleryViewMode } from '@/components/gallery/gallery-types';
import { GalleryMasonryGrid } from '@/components/gallery/gallery-masonry-grid';
import { GalleryCarouselViewer } from '@/components/gallery/gallery-carousel-viewer';

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
  const [mobileIndex, setMobileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<GalleryViewMode | null>(null); // null means closed
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Manage body scroll lock
  useEffect(() => {
    if (viewMode !== null) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [viewMode]);

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

  // Mobile slider controls
  const handleMobilePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleMobileNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

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
      {/* ── Mobile View Aspect Slider ─────────────────────────────────────── */}
      <div className="md:hidden relative aspect-[4/3] w-full overflow-hidden bg-slate-100 rounded-2xl border border-slate-100 shadow-xs">
        <Image
          src={displayImages[mobileIndex]?.r2_url}
          alt={displayImages[mobileIndex]?.alt || `Property image ${mobileIndex + 1}`}
          fill
          className="object-cover cursor-pointer"
          sizes="100vw"
          priority={mobileIndex === 0}
          placeholder={
            displayImages[mobileIndex]?.blur_data_url ? 'blur' : undefined
          }
          blurDataURL={displayImages[mobileIndex]?.blur_data_url || undefined}
          onClick={() => openGalleryAt(mobileIndex, 'carousel')}
        />

        {displayImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handleMobilePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-xs p-2 rounded-full shadow-md text-slate-700 hover:bg-white transition-all cursor-pointer z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleMobileNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-xs p-2 rounded-full shadow-md text-slate-700 hover:bg-white transition-all cursor-pointer z-10"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Counter pill */}
            <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-xs px-3 py-1 rounded-full text-[11px] font-extrabold text-white uppercase tracking-wider shadow-sm">
              {mobileIndex + 1} / {displayImages.length}
            </div>
          </>
        )}

        {/* Show all photos button */}
        {displayImages.length > 1 && (
          <button
            type="button"
            onClick={() => openGalleryAt(0, 'grid')}
            className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-slate-900 font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 transition-all cursor-pointer z-20"
          >
            <LayoutGrid className="h-4 w-4 text-emerald-600" />
            Show all photos
          </button>
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
