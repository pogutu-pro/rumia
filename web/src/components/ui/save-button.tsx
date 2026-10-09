'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia } from '@/lib/api/rumia';
import { track } from '@/lib/events';
import { useWishlistStore } from '@/stores/wishlist-store';
import { cn } from '@/lib/utils/cn';

interface SaveButtonProps {
  listingId: string;
  className?: string;
  variant?: 'icon' | 'text';
}

export function SaveButton({
  listingId,
  className = '',
  variant = 'text',
}: SaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isSaved = useWishlistStore((s) => s.saved[listingId] ?? false);
  const requestCheck = useWishlistStore((s) => s.requestCheck);
  const setSaved = useWishlistStore((s) => s.setSaved);

  useEffect(() => {
    requestCheck(listingId);
  }, [listingId, requestCheck]);

  // Saving needs no account: it is kept for this browser and moves into the account on sign-in.
  const handleToggle = useCallback(
    async (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isLoading) return;
      setIsLoading(true);
      const previous = isSaved;
      setSaved(listingId, !previous); // instant; undone below if the request fails
      try {
        const params = { params: { path: { listing_id: listingId } } };
        const result = previous
          ? await rumia.DELETE('/api/v1/saves/{listing_id}', params)
          : await rumia.PUT('/api/v1/saves/{listing_id}', params);
        if (result.error) throw new Error('save failed');
        track('save_toggled', { surface: 'property', listingId, props: { on: !previous } });
      } catch {
        setSaved(listingId, previous);
        toast.error('Could not update your saved places. Check your connection.');
      } finally {
        setIsLoading(false);
      }
    },
    [listingId, isSaved, setSaved, isLoading],
  );

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        onTouchEnd={(e) => {
          e.preventDefault();
        }}
        disabled={isLoading}
        style={{ touchAction: 'manipulation' }}
        className={cn(
          'pointer-events-auto inline-flex items-center justify-center rounded-full border bg-white shadow-md transition-all active:scale-95 touch-manipulation disabled:opacity-60',
          'h-11 w-11 md:h-11 md:w-11 border-white/70 backdrop-blur-sm hover:bg-white',
          isSaved
            ? 'text-red-500 hover:text-red-600 border-red-100'
            : 'text-slate-700 hover:text-slate-950',
          isLoading && 'opacity-70',
          className,
        )}
        aria-label={isSaved ? 'Remove from saved' : 'Save this place'}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <Heart
            className={`h-5 w-5 transition-colors ${isSaved ? 'fill-current' : ''}`}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      style={{ touchAction: 'manipulation' }}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold transition-colors touch-manipulation active:opacity-70 disabled:opacity-50',
        isSaved
          ? 'text-red-500 hover:text-red-600'
          : 'text-slate-600 hover:text-slate-900',
        className,
      )}
      aria-label={isSaved ? 'Remove from saved' : 'Save this place'}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={`h-4 w-4 transition-colors ${isSaved ? 'fill-current' : ''}`}
        />
      )}
      {isSaved ? 'Saved' : 'Save'}
    </button>
  );
}
