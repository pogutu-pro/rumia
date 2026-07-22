'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Heart, MapPin, ArrowRight, Loader2 } from 'lucide-react';

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

export function AccountSavedTab() {
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSaved() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('saved_hostels')
        .select(
          `id, listing_id, created_at,
           listings(id, title, price, location, slug, county, area,
             listing_images(r2_url, display_order, blur_data_url))`,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!cancelled && data) {
        setSaved(data as unknown as SavedListing[]);
      }
      setLoading(false);
    }

    fetchSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnsave(savedId: string) {
    setRemovingId(savedId);
    const supabase = createClient();
    await supabase.from('saved_hostels').delete().eq('id', savedId);
    setSaved((prev) => prev.filter((s) => s.id !== savedId));
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
          <Heart className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-1">
          No saved hostels yet
        </h3>
        <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
          Tap the heart on any listing to save it for later.
        </p>
        <Link
          href="/hostels"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          Browse hostels
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {saved.map((item) => {
        const listing = item.listings;
        if (!listing) return null;

        const image = listing.listing_images?.sort(
          (a, b) => a.display_order - b.display_order,
        )[0];

        const href = listing.slug
          ? `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`
          : `/listing/${listing.id}`;

        return (
          <div
            key={item.id}
            className="bg-white border border-slate-100 rounded-2xl overflow-hidden"
          >
            <div className="flex">
              <Link href={href} className="w-24 h-24 shrink-0 bg-slate-100 block">
                {image ? (
                  <Image
                    src={image.r2_url}
                    alt={listing.title}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    placeholder={image.blur_data_url ? 'blur' : undefined}
                    blurDataURL={image.blur_data_url || undefined}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart className="h-5 w-5 text-slate-200" />
                  </div>
                )}
              </Link>

              <div className="flex-1 p-3.5 min-w-0">
                <Link href={href} className="block min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-tight truncate hover:text-emerald-600 transition-colors">
                    {listing.title}
                  </p>
                </Link>
                <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {listing.location}
                </p>

                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-50">
                  <span className="text-sm font-black text-slate-900">
                    KES {listing.price.toLocaleString()}/mo
                  </span>
                  <button
                    onClick={() => handleUnsave(item.id)}
                    disabled={removingId === item.id}
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {removingId === item.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
