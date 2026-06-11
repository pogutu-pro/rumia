'use client';

import * as React from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ShareModal } from './share-modal';

interface ShareListingButtonProps {
  listing: {
    name: string;
    area: string;
    url: string;
    imageUrl?: string;
  };
  children?: React.ReactNode;
  className?: string;
  showLabel?: boolean;
  variant?: 'icon' | 'text';
}

export function ShareListingButton({
  listing,
  children,
  className,
  showLabel = true,
  variant = 'text',
}: ShareListingButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950',
            className,
          )}
          aria-label="Share listing"
        >
          <Share2 className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors',
            className,
          )}
          aria-label="Share listing"
        >
          <Share2 className="h-4 w-4" />
          {showLabel && <span>Share</span>}
          {children}
        </button>
      )}

      <ShareModal
        isOpen={isOpen}
        onClose={handleClose}
        listing={listing}
      />
    </>
  );
}
