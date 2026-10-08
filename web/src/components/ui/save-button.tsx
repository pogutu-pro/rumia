'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import { useWishlistStore } from '@/stores/wishlist-store';
import { cn } from '@/lib/utils/cn';
import posthog from 'posthog-js';

interface WishlistActionResponse {
  message: string;
  is_saved: boolean;
  listing_id: string;
}

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
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const isSaved = useWishlistStore((s) => s.saved[listingId] ?? false);
  const requestCheck = useWishlistStore((s) => s.requestCheck);
  const setSaved = useWishlistStore((s) => s.setSaved);

  useEffect(() => {
    requestCheck(listingId);
  }, [listingId, requestCheck]);

  const handleToggle = useCallback(async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    const previous = isSaved;
    setSaved(listingId, !previous);

    try {
      await apiClient<WishlistActionResponse>(`/profiles/me/wishlist/${listingId}`, {
        method: previous ? 'DELETE' : 'POST',
      });
      posthog.capture(previous ? 'hostel_unwishlisted' : 'hostel_wishlisted', {
        listing_id: listingId,
      });
    } catch {
      setSaved(listingId, previous);
    } finally {
      setIsLoading(false);
    }
  }, [listingId, isSaved, router, supabase, setSaved, isLoading]);

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
        aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
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
      aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={`h-4 w-4 transition-colors ${isSaved ? 'fill-current' : ''}`}
        />
      )}
      {isSaved ? 'In wishlist' : 'Save'}
    </button>
  );
}
