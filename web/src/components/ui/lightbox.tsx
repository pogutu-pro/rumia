'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface LightboxProps {
  images: { url: string; alt: string }[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function Lightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
}: LightboxProps) {
  const [current, setCurrent] = React.useState(currentIndex);
  const [prevIndex, setPrevIndex] = React.useState(currentIndex);

  // Sync when the parent opens the lightbox at a different index.
  if (currentIndex !== prevIndex) {
    setPrevIndex(currentIndex);
    setCurrent(currentIndex);
  }

  const navigate = React.useCallback(
    (direction: 'prev' | 'next') => {
      setCurrent((prev) =>
        direction === 'prev'
          ? (prev - 1 + images.length) % images.length
          : (prev + 1) % images.length,
      );
    },
    [images.length],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          navigate('next');
          break;
        case 'ArrowLeft':
          navigate('prev');
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, onClose, navigate]);

  const currentImage = images[current];

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent
        className={cn(
          'fixed inset-0 max-w-none w-full h-full bg-black/90 p-0 border-none rounded-none z-[99999]',
          'flex items-center justify-center backdrop-blur-sm',
        )}
      >
        {currentImage && (
          <div className="relative w-full h-full max-w-7xl max-h-[85vh]">
            <div className="relative w-full h-full">
              <Image
                src={currentImage.url}
                alt={currentImage.alt}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 100vw, 85vw"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
              onClick={onClose}
              aria-label="Close image viewer"
            >
              <X className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10"
              onClick={() => navigate('prev')}
              aria-label="Previous image"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10"
              onClick={() => navigate('next')}
              aria-label="Next image"
            >
              <ArrowRight className="h-6 w-6" />
            </Button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-sm select-none">
              {current + 1} / {images.length}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
