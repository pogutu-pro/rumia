'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CalendarCheck, MapPin, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import type { TourBooking } from '@/types';

interface TourBookingWithListing extends TourBooking {
  listings?: {
    id: string;
    title: string;
    area: string | null;
    slug: string | null;
    county: string | null;
    listing_images?: { r2_url: string; display_order: number }[];
  } | null;
}

export function AccountToursTab() {
  const [bookings, setBookings] = useState<TourBookingWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchBookings() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('tour_bookings')
        .select(
          `*, listings(id, title, area, slug, county, listing_images(r2_url, display_order))`,
        )
        .eq('linked_user_id', user.id)
        .order('preferred_date', { ascending: true })
        .order('preferred_time', { ascending: true });

      if (!cancelled && data) {
        setBookings(data as unknown as TourBookingWithListing[]);
      }
      setLoading(false);
    }

    fetchBookings();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
          <CalendarCheck className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-1">
          No tours booked yet
        </h3>
        <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
          Book a guided tour and let a verified agent show you the best options in person.
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
      {bookings.map((booking) => {
        const listing = booking.listings;
        const image = listing?.listing_images?.sort(
          (a, b) => a.display_order - b.display_order,
        )[0];

        const dateStr = new Date(booking.preferred_date + 'T00:00:00').toLocaleDateString(
          'en-KE',
          { weekday: 'short', month: 'short', day: 'numeric' },
        );

        const timeLabel =
          booking.preferred_time === 'morning'
            ? 'Morning'
            : booking.preferred_time === 'afternoon'
              ? 'Afternoon'
              : 'Evening';

        const listingHref =
          listing?.slug
            ? `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`
            : null;

        return (
          <div
            key={booking.id}
            className="bg-white border border-slate-100 rounded-2xl overflow-hidden"
          >
            <div className="flex">
              {image ? (
                <div className="w-24 h-24 shrink-0 bg-slate-100">
                  <img
                    src={image.r2_url}
                    alt={listing?.title || 'Hostel'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 shrink-0 bg-slate-50 flex items-center justify-center">
                  <CalendarCheck className="h-5 w-5 text-slate-200" />
                </div>
              )}

              <div className="flex-1 p-3.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {listing ? (
                      listingHref ? (
                        <Link
                          href={listingHref}
                          className="text-sm font-bold text-slate-900 leading-tight truncate block hover:text-emerald-600 transition-colors"
                        >
                          {listing.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                          {listing.title}
                        </p>
                      )
                    ) : (
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        Full Search Tour
                      </p>
                    )}
                    {listing?.area && (
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {listing.area}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={booking.status.replace('_', ' ')} />
                </div>

                <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3 text-slate-400" />
                    {dateStr}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {timeLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-50">
                  <span className="text-xs text-slate-400">
                    {booking.zone}
                    {booking.tour_type === 'full_search' ? ' (Full Search)' : ''}
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {formatTourPrice(booking.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
