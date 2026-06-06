'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SectionCarouselProps {
  images: { src: string; alt: string }[];
  className?: string;
  aspectRatio?: string;
}

export function SectionCarousel({
  images,
  className,
  aspectRatio = "aspect-square"
}: SectionCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);

  const paginate = (newDirection: number) => {
    setCurrentIndex((prevIndex) => (prevIndex + newDirection + images.length) % images.length);
  };

  // Auto-play
  React.useEffect(() => {
    if (isHovered || images.length <= 1) return;
    const timer = setInterval(() => paginate(1), 5000);
    return () => clearInterval(timer);
  }, [isHovered, images.length, currentIndex]);

  if (!images || images.length === 0) return null;

  return (
    <div 
      className={cn(
        "group relative w-full overflow-hidden rounded-[2rem] shadow-2xl border-8 border-white bg-gray-200 transition-all duration-500",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minHeight: '400px' }}
    >
      <div className={cn("relative w-full h-full min-h-[400px] overflow-hidden bg-gray-100", aspectRatio)}>
        {images.map((image, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 w-full h-full transition-all duration-700 ease-in-out transform",
              index === currentIndex ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-95"
            )}
          >
            {image.src && (
              <Image
                src={image.src}
                alt={image.alt || "Carousel image"}
                fill
                className="object-cover"
                quality={90}
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 600px"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>
        ))}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                paginate(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-white/90 backdrop-blur-md text-gray-800 shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:scale-110 active:scale-90"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                paginate(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-white/90 backdrop-blur-md text-gray-800 shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:scale-110 active:scale-90"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  index === currentIndex ? "w-6 bg-primary shadow-sm" : "w-1.5 bg-white/50 hover:bg-white"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
