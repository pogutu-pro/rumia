'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { Maximize2, Eye } from 'lucide-react';
import { GalleryImage } from './gallery-types';

interface GalleryMasonryGridProps {
  images: GalleryImage[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  onImageClick: (index: number) => void;
  onOpenCarousel: (index?: number) => void;
  onClose: () => void;
}

export function GalleryMasonryGrid({
  images,
  activeCategory,
  onSelectCategory,
  onImageClick,
  onOpenCarousel,
}: GalleryMasonryGridProps) {
  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    images.forEach((img) => {
      if (img.category) set.add(img.category);
    });
    return ['All', ...Array.from(set)];
  }, [images]);

  // Filtered images with their original index preserved
  const filteredImagesWithIndex = useMemo(() => {
    return images
      .map((image, originalIndex) => ({ image, originalIndex }))
      .filter(({ image }) => {
        if (activeCategory === 'All') return true;
        return image.category === activeCategory;
      });
  }, [images, activeCategory]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white text-slate-900 overflow-hidden">
      {/* Sticky Category Header Bar - Clean Airbnb Style */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? images.length
                : images.filter((img) => img.category === cat).length;
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-2 border ${
                  isActive
                    ? 'bg-slate-950 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-100/80 text-slate-600 border-slate-200/60 hover:bg-slate-200/80 hover:text-slate-950'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onOpenCarousel(0)}
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shrink-0 cursor-pointer shadow-sm"
        >
          <Eye className="h-4 w-4" />
          <span>Start Slideshow</span>
        </button>
      </div>

      {/* Editorial Masonry Grid Container */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 sm:py-6 max-h-[calc(100vh-130px)]">
        <div className="max-w-7xl mx-auto">
          {/* Multi-Column Masonry Grid: 2 columns on mobile/tablet, 3 columns on desktop */}
          <div className="columns-2 md:columns-2 lg:columns-3 gap-3 sm:gap-4 lg:gap-6 space-y-3 sm:space-y-4 lg:space-y-6 pb-20">
            {filteredImagesWithIndex.map(({ image, originalIndex }) => {
              const hasDimensions = image.width && image.height;
              const aspectRatio = hasDimensions
                ? image.width! / image.height!
                : undefined;

              return (
                <div
                  key={originalIndex}
                  onClick={() => onImageClick(originalIndex)}
                  className="break-inside-avoid relative group cursor-pointer overflow-hidden rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 shadow-xs transition-all duration-300 hover:shadow-md hover:border-slate-300"
                >
                  <div
                    className="relative w-full overflow-hidden"
                    style={{
                      aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
                    }}
                  >
                    <Image
                      src={image.r2_url}
                      alt={image.alt || `Hostel photo ${originalIndex + 1}`}
                      width={image.width || 800}
                      height={image.height || 600}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      placeholder={image.blur_data_url ? 'blur' : undefined}
                      blurDataURL={image.blur_data_url || undefined}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                    />

                    {/* Subtle Overlay & Action Icon */}
                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 sm:p-4">
                      <div className="flex justify-end">
                        <div className="p-2 sm:p-2.5 bg-white/95 backdrop-blur-md rounded-full border border-slate-200 text-slate-800 shadow-sm">
                          <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="bg-white/95 backdrop-blur-md border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-800 shadow-sm">
                          {image.category || 'Photo'} #{originalIndex + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
