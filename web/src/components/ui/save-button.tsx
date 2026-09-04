'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import posthog from 'posthog-js';

interface SavedActionResponse {
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
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        const res = await apiClient<SavedActionResponse>(
          `/profiles/me/saved/${listingId}`,
        );
        setIsSaved(res.is_saved);
      } catch {
        // Treated as not saved when the request fails.
      }
    })();
  }, [listingId]);

  const handleToggle = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push('/saved');
      return;
    }

    setIsLoading(true);
    const previous = isSaved;

    try {
      await apiClient<SavedActionResponse>(`/profiles/me/saved/${listingId}`, {
        method: isSaved ? 'DELETE' : 'POST',
      });
      setIsSaved(!previous);
      posthog.capture(previous ? 'hostel_unsaved' : 'hostel_saved', {
        listing_id: listingId,
      });
    } catch {
      setIsSaved(previous);
    } finally {
      setIsLoading(false);
    }
  }, [listingId, isSaved, router, supabase]);

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 shadow-md backdrop-blur-sm transition-colors hover:bg-white',
          isSaved
            ? 'text-red-500 hover:text-red-600'
            : 'text-slate-700 hover:text-slate-950',
          className,
        )}
        aria-label={isSaved ? 'Remove from saved' : 'Save hostel'}
      >
        <Heart
          className={`h-5 w-5 transition-colors ${isSaved ? 'fill-red-500 text-red-500' : ''}`}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold transition-colors',
        isSaved
          ? 'text-red-500 hover:text-red-600'
          : 'text-slate-600 hover:text-slate-900',
        className,
      )}
      aria-label={isSaved ? 'Remove from saved' : 'Save hostel'}
    >
      <Heart
        className={`h-4 w-4 transition-colors ${isSaved ? 'fill-red-500 text-red-500' : ''}`}
      />
      {isSaved ? 'Saved' : 'Save'}
    </button>
  );
}
