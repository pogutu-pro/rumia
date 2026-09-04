'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { GalleryImage } from './gallery-types';

interface GalleryCarouselViewerProps {
  images: GalleryImage[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onSwitchToGrid: () => void;
  onClose: () => void;
}

export function GalleryCarouselViewer({
  images,
  currentIndex,
  onNavigate,
  onSwitchToGrid,
  onClose,
}: GalleryCarouselViewerProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [direction, setDirection] = useState<number>(0);

  const totalImages = images.length;
  const currentImage = images[currentIndex] || images[0];

  const handlePrev = useCallback(() => {
    setIsZoomed(false);
    setDirection(-1);
    onNavigate(currentIndex === 0 ? totalImages - 1 : currentIndex - 1);
  }, [currentIndex, totalImages, onNavigate]);

  const handleNext = useCallback(() => {
    setIsZoomed(false);
    setDirection(1);
    onNavigate(currentIndex === totalImages - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, totalImages, onNavigate]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // Mobile Drag / Touch Swipe gesture handler
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (isZoomed) return; // Disable drag navigation when zoomed in

    const swipeThreshold = 50;
    const velocityThreshold = 200;

    if (
      info.offset.x < -swipeThreshold ||
      info.velocity.x < -velocityThreshold
    ) {
      handleNext();
    } else if (
      info.offset.x > swipeThreshold ||
      info.velocity.x > velocityThreshold
    ) {
      handlePrev();
    }
  };

  // Preload adjacent images
  const prevIndex = (currentIndex - 1 + totalImages) % totalImages;
  const nextIndex = (currentIndex + 1) % totalImages;

  // Slide animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 250 : -250,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 250 : -250,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-neutral-950 text-white flex flex-col justify-between overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Full screen photo gallery"
    >
      {/* Preload adjacent images silently */}
      {/* eslint-disable @next/next/no-img-element */}
      <div className="hidden">
        {images[prevIndex]?.r2_url && (
          <img src={images[prevIndex].r2_url} alt="preload prev" />
        )}
        {images[nextIndex]?.r2_url && (
          <img src={images[nextIndex].r2_url} alt="preload next" />
        )}
      </div>
      {/* eslint-enable @next/next/no-img-element */}

      {/* Top Controls Header - Clean Minimal Bar */}
      <div className="sticky top-0 z-30 bg-neutral-950/80 px-4 sm:px-8 py-4 flex items-center justify-between backdrop-blur-md border-b border-neutral-800/60">
        {/* Left: Category Badge & Grid Switcher */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToGrid}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
            aria-label="Switch to grid view"
          >
            <LayoutGrid className="h-4 w-4 text-white" />
            <span className="hidden sm:inline">Grid View</span>
          </button>

          {currentImage.category && (
            <span className="hidden md:inline-flex items-center px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-bold uppercase tracking-wider text-neutral-300">
              {currentImage.category}
            </span>
          )}
        </div>

        {/* Center: Clean Counter */}
        <div className="flex items-center justify-center">
          <div className="px-4 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 shadow-sm backdrop-blur-md">
            <span className="text-xs sm:text-sm font-extrabold tracking-wider text-white">
              {currentIndex + 1}
            </span>
            <span className="text-xs sm:text-sm font-medium text-neutral-500 mx-1">
              /
            </span>
            <span className="text-xs sm:text-sm font-semibold text-neutral-400">
              {totalImages}
            </span>
          </div>
        </div>

        {/* Right: Zoom Toggle & Close Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all cursor-pointer"
            aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
          >
            {isZoomed ? (
              <ZoomOut className="h-4 w-4 text-white" />
            ) : (
              <ZoomIn className="h-4 w-4 text-white" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all cursor-pointer shadow-xs"
            aria-label="Close photo viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage Container */}
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Navigation Arrow Left (Desktop) */}
        {totalImages > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 sm:left-8 z-20 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-white transition-all shadow-xl cursor-pointer hover:scale-105 hidden sm:flex items-center justify-center"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Animated Image Canvas */}
        <div className="relative w-full h-full flex items-center justify-center max-w-6xl">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag={isZoomed ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              onDoubleClick={() => setIsZoomed(!isZoomed)}
              className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 touch-pan-y"
            >
              <div
                className={`relative max-w-full max-h-full transition-transform duration-300 ${
                  isZoomed ? 'scale-150 sm:scale-175 cursor-zoom-out' : 'cursor-zoom-in'
                }`}
              >
                <Image
                  src={currentImage.r2_url}
                  alt={currentImage.alt || `Photo ${currentIndex + 1}`}
                  width={currentImage.width || 1200}
                  height={currentImage.height || 800}
                  priority
                  placeholder={
                    currentImage.blur_data_url ? 'blur' : undefined
                  }
                  blurDataURL={currentImage.blur_data_url || undefined}
                  className="max-h-[72vh] sm:max-h-[78vh] w-auto max-w-full object-contain rounded-xl sm:rounded-2xl shadow-xl"
                  unoptimized={isZoomed}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Arrow Right (Desktop) */}
        {totalImages > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 sm:right-8 z-20 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-white transition-all shadow-xl cursor-pointer hover:scale-105 hidden sm:flex items-center justify-center"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip Container */}
      <div className="sticky bottom-0 z-30 bg-neutral-950/90 pt-3 pb-4 px-4 sm:px-8 border-t border-neutral-800/60 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-2">
          {images.map((img, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIsZoomed(false);
                  setDirection(idx > currentIndex ? 1 : -1);
                  onNavigate(idx);
                }}
                className={`relative shrink-0 h-14 w-20 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-white scale-105 shadow-md opacity-100 ring-2 ring-white/20'
                    : 'border-neutral-800 opacity-50 hover:opacity-90 hover:border-neutral-600'
                }`}
              >
                <Image
                  src={img.r2_url}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
