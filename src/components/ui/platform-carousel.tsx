'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CarouselSlide {
  src: string;
  alt: string;
  title?: string;
  description?: string;
}

interface PlatformCarouselProps {
  slides: CarouselSlide[];
  autoPlayInterval?: number;
  className?: string;
}

export function PlatformCarousel({
  slides,
  autoPlayInterval = 5000,
  className,
}: PlatformCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [direction, setDirection] = React.useState<'left' | 'right'>('right');

  // Auto-play functionality
  React.useEffect(() => {
    if (isHovered || slides.length <= 1) return;

    const interval = setInterval(() => {
      setDirection('right');
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isHovered, slides.length, autoPlayInterval]);

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    setDirection(index > currentIndex ? 'right' : 'left');
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setDirection('left');
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setDirection('right');
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  if (slides.length === 0) return null;

  return (
    <div
      className={cn('relative w-full max-w-6xl mx-auto', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Carousel Container */}
      <div 
        className="relative aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-gray-100 to-gray-200"
        style={{ position: 'relative' }}
      >
        {/* Slides */}
        {slides.map((slide, index) => (
          <div
            key={index}
            className={cn(
              'absolute inset-0 transition-all duration-700 ease-in-out',
              index === currentIndex
                ? 'opacity-100 scale-100 z-10'
                : 'opacity-0 scale-95 z-0',
              direction === 'right' && index === currentIndex && 'animate-in slide-in-from-right',
              direction === 'left' && index === currentIndex && 'animate-in slide-in-from-left'
            )}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-cover"
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            {/* Text Overlay */}
            {(slide.title || slide.description) && (
              <div className="absolute bottom-0 left-0 right-0 p-6 xs:p-8 md:p-12">
                <div className="max-w-3xl">
                  {slide.title && (
                    <h3 className="text-2xl xs:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 xs:mb-3 drop-shadow-lg">
                      {slide.title}
                    </h3>
                  )}
                  {slide.description && (
                    <p className="text-sm xs:text-base md:text-lg text-white/90 drop-shadow-md">
                      {slide.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Navigation Arrows - Show on hover for desktop */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className={cn(
                'absolute left-4 top-1/2 -translate-y-1/2 z-20',
                'bg-white/90 backdrop-blur-sm hover:bg-white',
                'rounded-full p-2 xs:p-3 shadow-lg',
                'transition-all duration-300',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'opacity-0 group-hover:opacity-100 hover:scale-110',
                isHovered ? 'opacity-100' : 'opacity-0 md:opacity-0'
              )}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5 xs:h-6 xs:w-6 text-gray-800" />
            </button>
            <button
              onClick={goToNext}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 z-20',
                'bg-white/90 backdrop-blur-sm hover:bg-white',
                'rounded-full p-2 xs:p-3 shadow-lg',
                'transition-all duration-300',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'opacity-0 group-hover:opacity-100 hover:scale-110',
                isHovered ? 'opacity-100' : 'opacity-0 md:opacity-0'
              )}
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5 xs:h-6 xs:w-6 text-gray-800" />
            </button>
          </>
        )}
      </div>

      {/* Navigation Dots */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                index === currentIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              )}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {slides.length > 1 && !isHovered && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 overflow-hidden rounded-b-2xl">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${((currentIndex + 1) / slides.length) * 100}%`,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>
      )}
    </div>
  );
}
