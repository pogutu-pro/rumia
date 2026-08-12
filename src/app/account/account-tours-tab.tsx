'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarCheck,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
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

type TourFilter = 'all' | 'upcoming' | 'completed' | 'cancelled';

interface AccountToursTabProps {
  onBackToOverview?: () => void;
}

export function AccountToursTab({ onBackToOverview }: AccountToursTabProps) {
  const [bookings, setBookings] = useState<TourBookingWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<TourBookingWithListing | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TourFilter>('upcoming');

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

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'upcoming') {
      return bookings.filter(
        (b) => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show',
      );
    }
    if (activeFilter === 'completed') {
      return bookings.filter((b) => b.status === 'completed');
    }
    if (activeFilter === 'cancelled') {
      return bookings.filter((b) => b.status === 'cancelled' || b.status === 'no_show');
    }
    return bookings;
  }, [bookings, activeFilter]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-9 w-36 rounded-xl" />
        </div>
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
        <span className="sr-only">Loading your tours</span>
      </div>
    );
  }

  const upcomingCount = bookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show',
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled' || b.status === 'no_show').length;

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

      {/* Top Header & Back Button */}
      <div className="flex items-center justify-between">
        {onBackToOverview ? (
          <button
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </button>
        ) : (
          <Link
            href="/account?tab=overview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        )}

        <Link
          href="/account/book-tour"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Book Another Tour
        </Link>
      </div>

      {/* Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:px-6">
        <h2 className="text-base font-bold text-slate-900">Your Tour Bookings</h2>
        <p className="text-xs text-slate-500">
          {upcomingCount} upcoming · {completedCount} completed · {cancelledCount} cancelled
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {(
          [
            { id: 'all', label: 'All Tours', count: bookings.length },
            { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
          ] as const
        ).map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === filter.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{filter.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeFilter === filter.id ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bookings List or Empty State */}
      {bookings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No tours booked yet
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            Book a guided tour to visit student hostels near DeKUT with a verified agent.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/account/book-tour"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <CalendarPlus className="h-4 w-4" />
              Book a Tour
            </Link>
            <Link
              href="/hostels"
              className="inline-flex items-center gap-1 h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Browse hostels
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : filteredBookings.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100">
          {filteredBookings.map((booking) => (
            <TourRow
              key={booking.id}
              booking={booking}
              onEdit={() => setEditingBooking(booking)}
              onCancel={() => handleCancel(booking.id)}
              isCancelling={cancellingId === booking.id}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-500 bg-white border border-slate-200/80 rounded-2xl">
          No {activeFilter} tours found.
        </div>
      )}
    </div>
  );
}

// ── Tour Row ───────────────────────────────────────────────────────────────

function TourRow({
  booking,
  onEdit,
  onCancel,
  isCancelling,
}: {
  booking: TourBookingWithListing;
  onEdit?: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
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

  const isPast = booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show';
  const canEdit = booking.status === 'pending_payment' && !isPast;
  const canCancel =
    (booking.status === 'pending_payment' || booking.status === 'confirmed') && !isPast;
  const isActive = !isPast;

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 transition-colors hover:bg-slate-50/80 ${
        isPast ? 'opacity-70' : ''
      }`}
    >
      {/* Thumbnail */}
      {image ? (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
          <img
            src={image.r2_url}
            alt={listing?.title || 'Hostel'}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/60">
          <CalendarCheck className="h-5 w-5 text-slate-400" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {listing ? (
              listingHref ? (
                <Link
                  href={listingHref}
                  className="text-sm font-bold text-slate-900 leading-tight truncate block hover:text-emerald-700 transition-colors"
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
                Full Guided Search Tour
              </p>
            )}
          </div>
          <StatusBadge
            status={booking.status.replace(/_/g, ' ')}
            variantMap={TOUR_STATUS_VARIANT_MAP}
          />
        </div>

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium">
            <CalendarCheck className="h-3 w-3 text-slate-400" />
            {dateStr}
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <TimeIcon className="h-3 w-3 text-slate-400" />
            {timeLabel}
          </span>
          {listing?.area && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-400" />
              {listing.area}
            </span>
          )}
          <span className="font-bold text-slate-900 tabular-nums">
            {formatTourPrice(booking.amount)}
          </span>
        </div>

        {/* Countdown */}
        {isActive && (
          <div className="pt-1">
            <TourCountdown
              preferredDate={booking.preferred_date}
              preferredTime={booking.preferred_time as 'morning' | 'afternoon' | 'evening'}
              compact
            />
          </div>
        )}
      </div>

      {/* Actions */}
      {(canEdit || canCancel) && (
        <div className="flex items-center gap-2 sm:self-center pt-2 sm:pt-0 shrink-0">
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
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
  );
}
