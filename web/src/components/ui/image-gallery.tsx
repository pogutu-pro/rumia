'use client';

import * as React from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ImageGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  images: { url: string; alt: string }[];
  onImageClick?: (index: number) => void;
  maxVisible?: number;
}

/**
 * Displays a grid of hostel images, emphasizing the first one, similar to Airbnb listings.
 */
export function ImageGallery({
  images,
  onImageClick,
  maxVisible = 5,
  className,
  ...props
}: ImageGalleryProps) {
  if (!images || images.length === 0) {
    return (
      <div className="h-96 w-full flex items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground">
        No images available
      </div>
    );
  }

  // Ensure only the maximum visible images are used
  const displayImages = images.slice(0, maxVisible);
  const remainingCount = images.length - maxVisible;

  // Keyboard handler for image divs
  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onImageClick?.(index);
    }
  };

  return (
    <div
      className={cn('grid gap-2 overflow-hidden rounded-xl', className)}
      {...props}
    >
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[400px]">
        {/* Main Image */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`View image 1: ${displayImages[0].alt}`}
          className="relative col-span-2 row-span-2 cursor-pointer transition-opacity duration-200 hover:opacity-90 outline-none focus-visible:ring focus-visible:ring-primary rounded-l-xl"
          onClick={() => onImageClick && onImageClick(0)}
          onKeyDown={(e) => handleKeyDown(0, e)}
        >
          <Image
            src={displayImages[0].url}
            alt={displayImages[0].alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover rounded-l-xl"
            priority
          />
        </div>

        {/* Smaller Images */}
        {displayImages.slice(1, maxVisible).map((image, index) => {
          const actualIndex = index + 1;
          const isLastVisible =
            actualIndex === maxVisible - 1 && remainingCount > 0;

          return (
            <div
              key={image.url}
              role="button"
              tabIndex={0}
              aria-label={`View image ${actualIndex + 1}: ${image.alt}${isLastVisible ? ` plus ${remainingCount} more images` : ''}`}
              className={cn(
                'relative transition-opacity duration-200 hover:opacity-90 cursor-pointer outline-none focus-visible:ring focus-visible:ring-primary rounded-tr-xl rounded-br-xl',
                isLastVisible &&
                  'after:absolute after:inset-0 after:bg-black/40 rounded-br-xl',
              )}
              onClick={() => onImageClick && onImageClick(actualIndex)}
              onKeyDown={(e) => handleKeyDown(actualIndex, e)}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className={cn(
                  'object-cover',
                  isLastVisible ? 'rounded-br-xl' : '',
                )}
              />

              {isLastVisible && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="text-white text-xl font-bold flex items-center select-none">
                    <Plus className="h-6 w-6 mr-1" aria-hidden="true" />
                    {remainingCount}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
