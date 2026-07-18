'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

interface SaveButtonProps {
  listingId: string;
  className?: string;
  variant?: 'icon' | 'text';
}

export function SaveButton({ listingId, className = '', variant = 'text' }: SaveButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase
        .from('saved_hostels')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('listing_id', listingId)
        .maybeSingle();

      setIsSaved(!!data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const handleToggle = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push('/saved');
      return;
    }

    setIsLoading(true);

    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_hostels')
          .delete()
          .eq('user_id', session.user.id)
          .eq('listing_id', listingId);

        if (error) throw error;
        setIsSaved(false);
      } else {
        const { error } = await supabase
          .from('saved_hostels')
          .insert({ user_id: session.user.id, listing_id: listingId });

        if (error) throw error;
        setIsSaved(true);
      }
    } catch {
      setIsSaved(isSaved);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, isSaved]);

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 shadow-md backdrop-blur-sm transition-colors hover:bg-white',
          isSaved ? 'text-red-500 hover:text-red-600' : 'text-slate-700 hover:text-slate-950',
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
