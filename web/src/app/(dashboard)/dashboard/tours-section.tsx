'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  CalendarCheck,
  Clock,
  MapPin,
  Phone,
  Sun,
  Sunset,
  Moon,
  MessageCircle,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TourCountdown } from '@/components/tour-countdown';
import { updateTourBookingStatusAction } from '@/app/actions/tour-bookings';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import { buildWhatsAppUrl, tourConfirmationMessage } from '@/lib/utils/phone';
import type { TourBookingWithJoins, TourStatus } from '@/types';

interface ToursSectionProps {
  bookings: TourBookingWithJoins[];
}

const TOUR_STATUS_VARIANT_MAP: Record<
  string,
  'active' | 'pending' | 'rejected' | 'success' | 'draft' | 'info'
> = {
  'pending payment': 'pending',
  confirmed: 'info',
  paid: 'success',
  messaged: 'success',
  completed: 'success',
  'no show': 'rejected',
  cancelled: 'rejected',
};

const TIME_ICONS: Record<string, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

/** Display label for a booking status — contacted shows as "Messaged". */
function tourStatusLabel(status: string): string {
  if (status === 'contacted') return 'Messaged';
  return status.replace(/_/g, ' ');
}

/** Builds a WhatsApp deep-link that confirms the agent will be there. */
function tourConfirmHref(b: TourBookingWithJoins): string {
  const date = new Date(b.preferred_date + 'T00:00:00').toLocaleDateString(
    'en-KE',
    { weekday: 'short', month: 'short', day: 'numeric' },
  );
  const timeLabel =
    b.preferred_time.charAt(0).toUpperCase() + b.preferred_time.slice(1);
  const message = tourConfirmationMessage({
    studentName: b.student_name,
    agentName: b.agents?.name || 'your agent',
    date,
    timeLabel,
    zone: b.zone,
    listingTitle: b.listings?.title || undefined,
    agentPhone: b.agents?.whatsapp || b.agents?.phone || undefined,
  });
  return buildWhatsAppUrl(b.phone, message);
}

type TourFilter = 'all' | 'upcoming' | 'completed' | 'cancelled';

export function ToursSection({ bookings }: ToursSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TourFilter>('upcoming');
  const [localBookings, setLocalBookings] = useState(bookings);

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'upcoming') {
      return localBookings.filter(
        (b) =>
          b.status !== 'cancelled' &&
          b.status !== 'completed' &&
          b.status !== 'no_show',
      );
    }
    if (activeFilter === 'completed') {
      return localBookings.filter((b) => b.status === 'completed');
    }
    if (activeFilter === 'cancelled') {
      return localBookings.filter(
        (b) => b.status === 'cancelled' || b.status === 'no_show',
      );
    }
    return localBookings;
  }, [localBookings, activeFilter]);

  const upcomingCount = localBookings.filter(
    (b) =>
      b.status !== 'cancelled' &&
      b.status !== 'completed' &&
      b.status !== 'no_show',
  ).length;
  const completedCount = localBookings.filter(
    (b) => b.status === 'completed',
  ).length;
  const cancelledCount = localBookings.filter(
    (b) => b.status === 'cancelled' || b.status === 'no_show',
  ).length;

  /** Opens WhatsApp with the pre-filled confirmation and marks as contacted. */
  function handleMessage(b: TourBookingWithJoins) {
    window.open(tourConfirmHref(b), '_blank', 'noopener,noreferrer');
    if (b.status === 'contacted') return;

    setActionError(null);
    startTransition(async () => {
      const result = await updateTourBookingStatusAction(b.id, 'contacted');
      if (result.success) {
        setLocalBookings((prev) =>
          prev.map((x) =>
            x.id === b.id ? { ...x, status: 'contacted' as TourStatus } : x,
          ),
        );
      } else {
        setActionError(result.error);
      }
    });
  }

  if (localBookings.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          No tour bookings yet
        </h3>
        <p className="text-sm text-slate-500">
          Tour bookings from students will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
          {actionError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {(
          [
            { id: 'all', label: 'All Tours', count: localBookings.length },
            { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
            {
              id: 'cancelled',
              label: 'Cancelled',
              count: cancelledCount,
            },
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
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilter === filter.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Student', 'Date & Time', 'Listing', 'Amount', 'Status', 'Contact'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left px-5 py-3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.map((b) => {
              const isActive =
                b.status !== 'cancelled' &&
                b.status !== 'completed' &&
                b.status !== 'no_show';
              const isTerminal =
                b.status === 'cancelled' || b.status === 'no_show';

              return (
                <tr
                  key={b.id}
                  className={isTerminal ? 'opacity-60' : 'hover:bg-slate-50/60 transition-colors'}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-900">
                      {b.student_name}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {b.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {new Date(
                        b.preferred_date + 'T00:00:00',
                      ).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {b.preferred_time.charAt(0).toUpperCase() +
                        b.preferred_time.slice(1)}
                    </p>
                    {isActive && (
                      <div className="mt-1.5">
                        <TourCountdown
                          preferredDate={b.preferred_date}
                          preferredTime={
                            b.preferred_time as
                              | 'morning'
                              | 'afternoon'
                              | 'evening'
                          }
                          compact
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                    {b.listings?.title || b.zone}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 tabular-nums">
                    {formatTourPrice(b.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      status={tourStatusLabel(b.status)}
                      variantMap={TOUR_STATUS_VARIANT_MAP}
                    />
                  </td>
                  <td className="px-5 py-4">
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleMessage(b)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {b.status === 'contacted' ? 'Message again' : 'Message'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredBookings.map((b) => {
          const isActive =
            b.status !== 'cancelled' &&
            b.status !== 'completed' &&
            b.status !== 'no_show';
          const isTerminal =
            b.status === 'cancelled' || b.status === 'no_show';

          return (
            <div
              key={b.id}
              className={`bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 ${
                isTerminal ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    {b.student_name}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {b.phone}
                  </p>
                </div>
                <StatusBadge
                  status={tourStatusLabel(b.status)}
                  variantMap={TOUR_STATUS_VARIANT_MAP}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                  {new Date(
                    b.preferred_date + 'T00:00:00',
                  ).toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {b.preferred_time.charAt(0).toUpperCase() +
                    b.preferred_time.slice(1)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {b.listings?.title || b.zone}
                </div>
                <div className="font-bold text-slate-900 tabular-nums">
                  {formatTourPrice(b.amount)}
                </div>
                {isActive && (
                  <div className="col-span-2">
                    <TourCountdown
                      preferredDate={b.preferred_date}
                      preferredTime={
                        b.preferred_time as
                          | 'morning'
                          | 'afternoon'
                          | 'evening'
                      }
                      compact
                    />
                  </div>
                )}
              </div>

              {isActive && (
                <button
                  type="button"
                  onClick={() => handleMessage(b)}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <MessageCircle className="h-3 w-3" />
                  {b.status === 'contacted' ? 'Message again' : 'Message'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty Filter State */}
      {filteredBookings.length === 0 && localBookings.length > 0 && (
        <div className="py-12 text-center text-xs text-slate-500 bg-white border border-slate-200/80 rounded-2xl">
          No {activeFilter} tours found.
        </div>
      )}
    </div>
  );
}