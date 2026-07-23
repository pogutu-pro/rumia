'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarCheck,
  MapPin,
  Clock,
  ArrowRight,
  Loader2,
  CalendarPlus,
  Pencil,
  XCircle,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TourCountdown } from '@/components/tour-countdown';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import { cancelStudentTourBookingAction } from '@/app/actions/student-tour-bookings';
import { EditTourModal } from './edit-tour-modal';
import type { TourBooking, TourTimeWindow } from '@/types';

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

const TOUR_STATUS_VARIANT_MAP: Record<string, 'active' | 'pending' | 'rejected' | 'success' | 'draft' | 'info'> = {
  pending_payment: 'pending',
  confirmed: 'info',
  paid: 'success',
  completed: 'success',
  no_show: 'rejected',
  cancelled: 'rejected',
};

const TIME_ICONS: Record<string, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

export function AccountToursTab() {
  const [bookings, setBookings] = useState<TourBookingWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<TourBookingWithListing | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

    if (data) {
      setBookings(data as unknown as TourBookingWithListing[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
  }, [fetchBookings]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    const result = await cancelStudentTourBookingAction(bookingId);
    if (result.success) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: 'cancelled' as const } : b,
        ),
      );
    }
    setCancellingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (bookings.length === 0) {
    return (
      <div className="py-8">
        <div className="bg-white border border-slate-100 rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 mx-auto flex items-center justify-center mb-5">
            <CalendarCheck className="h-7 w-7 text-slate-300" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-1.5">
            No tours yet
          </h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed mb-6">
            Book a guided tour and let a verified agent show you the best
            hostels near DeKUT in person.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/account/book-tour"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all"
            >
              <CalendarPlus className="h-4 w-4" />
              Book a Tour
            </Link>
            <Link
              href="/hostels"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all"
            >
              Browse first
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Has bookings ──────────────────────────────────────────────────────────

  const activeBookings = bookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show',
  );
  const pastBookings = bookings.filter(
    (b) => b.status === 'cancelled' || b.status === 'completed' || b.status === 'no_show',
  );

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingBooking && (
        <EditTourModal
          key={editingBooking.id}
          isOpen={true}
          onClose={() => setEditingBooking(null)}
          bookingId={editingBooking.id}
          currentDate={editingBooking.preferred_date}
          currentTime={editingBooking.preferred_time as TourTimeWindow}
          currentPhone={editingBooking.phone}
          onSuccess={fetchBookings}
        />
      )}

      {/* Book another */}
      <Link
        href="/account/book-tour"
        className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group cursor-pointer"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-emerald-600 flex items-center justify-center transition-colors">
          <CalendarPlus className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Book another tour</p>
          <p className="text-xs text-slate-400">Explore more hostels with a guided visit</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
      </Link>

      {/* Active bookings */}
      {activeBookings.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Upcoming
          </h3>
          <div className="space-y-3">
            {activeBookings.map((booking) => (
              <TourCard
                key={booking.id}
                booking={booking}
                onEdit={() => setEditingBooking(booking)}
                onCancel={() => handleCancel(booking.id)}
                isCancelling={cancellingId === booking.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past bookings */}
      {pastBookings.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Past
          </h3>
          <div className="space-y-3">
            {pastBookings.map((booking) => (
              <TourCard
                key={booking.id}
                booking={booking}
                isPast
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tour Card ──────────────────────────────────────────────────────────────

function TourCard({
  booking,
  onEdit,
  onCancel,
  isCancelling,
  isPast,
}: {
  booking: TourBookingWithListing;
  onEdit?: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
  isPast?: boolean;
}) {
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

  const TimeIcon = TIME_ICONS[booking.preferred_time] || Clock;

  const listingHref =
    listing?.slug
      ? `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`
      : null;

  const canEdit = booking.status === 'pending_payment' && !isPast;
  const canCancel =
    (booking.status === 'pending_payment' || booking.status === 'confirmed') && !isPast;
  const isActive = !isPast && booking.status !== 'cancelled' && booking.status !== 'completed' && booking.status !== 'no_show';

  return (
    <div
      className={`bg-white border rounded-2xl overflow-hidden transition-all ${
        isPast ? 'border-slate-100 opacity-70' : 'border-slate-100 hover:shadow-md'
      }`}
    >
      <div className="flex">
        {/* Image */}
        {image ? (
          <div className="w-28 sm:w-32 shrink-0 bg-slate-100">
            <img
              src={image.r2_url}
              alt={listing?.title || 'Hostel'}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-28 sm:w-32 shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <CalendarCheck className="h-8 w-8 text-slate-200" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
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
            <StatusBadge
              status={booking.status.replace(/_/g, ' ')}
              variantMap={TOUR_STATUS_VARIANT_MAP}
            />
          </div>

          {/* Date & Time pills */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
              <CalendarCheck className="h-3 w-3 text-slate-400" />
              {dateStr}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
              <TimeIcon className="h-3 w-3 text-slate-400" />
              {timeLabel}
            </span>
          </div>

          {/* Countdown */}
          {isActive && (
            <div className="mb-3">
              <TourCountdown
                preferredDate={booking.preferred_date}
                preferredTime={booking.preferred_time as 'morning' | 'afternoon' | 'evening'}
                compact
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {booking.zone}
                {booking.tour_type === 'full_search' ? ' (Full Search)' : ''}
              </span>
              <span className="text-sm font-black text-slate-900">
                {formatTourPrice(booking.amount)}
              </span>
            </div>

            {(canEdit || canCancel) && (
              <div className="flex items-center gap-1.5">
                {canEdit && onEdit && (
                  <button
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
                {canCancel && onCancel && (
                  <button
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
