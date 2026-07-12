'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle, getSession } from '@/lib/supabase/auth';
import { Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';

interface SavedListing {
  id: string;
  listing_id: string;
  created_at: string;
  listings: {
    id: string;
    title: string;
    price: number;
    location: string;
    slug: string;
    county: string;
    area: string;
    listing_images: { r2_url: string; display_order: number; blur_data_url?: string }[];
  };
}

export default function SavedPage() {
  const [session, setSession] = useState<any>(null);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { session: currentSession } = await getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        const supabase = createClient();
        const { data } = await supabase
          .from('saved_hostels')
          .select(`
            id,
            listing_id,
            created_at,
            listings (
              id, title, price, location, slug, county, area,
              listing_images ( r2_url, display_order, blur_data_url )
            )
          `)
          .eq('user_id', currentSession.user.id)
          .order('created_at', { ascending: false });

        if (data) setSavedListings(data as unknown as SavedListing[]);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-white py-16 px-4">
        <div className="max-w-sm w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center ring-1 ring-rose-100">
              <Heart className="h-8 w-8 text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Save hostels you love
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Sign in to save hostels, compare options, and find them easily later.
            </p>
          </div>

          <button
            onClick={() => signInWithGoogle('/saved')}
            className="w-full flex items-center justify-center gap-3 h-13 py-3.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <p className="text-sm text-slate-400">
            <Link href="/hostels" className="font-semibold text-slate-800 hover:text-emerald-600 underline underline-offset-2 decoration-slate-200 hover:decoration-emerald-300 transition-colors">
              Browse hostels
            </Link>
            {' '}instead
          </p>
        </div>
      </div>
    );
  }

  if (savedListings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        <div className="text-center">
          <Heart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700">No saved hostels yet</h2>
          <p className="text-sm text-slate-400 mt-1">
            Tap the heart on any listing to save it for later.
          </p>
        </div>
        <EarlyAccessBanner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Saved Hostels</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {savedListings.map((saved) => {
          const listing = saved.listings;
          const image = listing.listing_images?.sort(
            (a, b) => a.display_order - b.display_order,
          )[0];
          const imageUrl = image?.r2_url;
          const blurDataUrl = image?.blur_data_url;

          return (
            <Link
              key={saved.id}
              href={`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`}
              className="group flex overflow-hidden rounded-2xl border border-slate-100 bg-white transition-all hover:shadow-lg"
            >
              <div className="relative w-32 h-32 shrink-0 bg-slate-100">
                {image ? (
                  <Image
                    src={imageUrl}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    sizes="128px"
                    placeholder={blurDataUrl ? 'blur' : undefined}
                    blurDataURL={blurDataUrl || undefined}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center p-4">
                <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-emerald-600">
                  {listing.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                  {listing.location}
                </p>
                <p className="text-sm font-bold text-slate-900 mt-2">
                  KES {listing.price.toLocaleString()}/mo
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <EarlyAccessBanner />
    </div>
  );
}
