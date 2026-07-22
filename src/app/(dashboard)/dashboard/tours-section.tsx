'use client';

import { useState, useTransition } from 'react';
import { CalendarCheck, Clock, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { updateTourBookingStatusAction } from '@/app/actions/tour-bookings';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import type { TourBookingWithJoins, TourStatus } from '@/types';

interface ToursSectionProps {
  bookings: TourBookingWithJoins[];
}

const STATUS_ACTIONS: Partial<Record<TourStatus, TourStatus>> = {
  pending_payment: 'confirmed',
  confirmed: 'paid',
  paid: 'completed',
};

const STATUS_ACTION_LABELS: Partial<Record<TourStatus, string>> = {
  pending_payment: 'Confirm',
  confirmed: 'Mark Paid',
  paid: 'Mark Completed',
};

const TOUR_STATUS_VARIANT_MAP: Record<string, 'active' | 'pending' | 'rejected' | 'success' | 'draft' | 'info'> = {
  pending_payment: 'pending',
  confirmed: 'info',
  paid: 'success',
  completed: 'success',
  no_show: 'rejected',
  cancelled: 'rejected',
};

export function ToursSection({ bookings }: ToursSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleStatusUpdate(bookingId: string, newStatus: TourStatus) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateTourBookingStatusAction(bookingId, newStatus);
      if (!result.success) {
        setActionError(result.error);
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-slate-400 font-semibold">
        No tour bookings yet.
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

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Student', 'Date & Time', 'Zone', 'Type', 'Amount', 'Status', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left px-5 py-3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{b.student_name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {b.phone}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-700">
                    {new Date(b.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {b.preferred_time.charAt(0).toUpperCase() + b.preferred_time.slice(1)}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-700">{b.zone}</td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {b.tour_type === 'specific_hostel' ? 'Specific' : 'Full Search'}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-900">
                  {formatTourPrice(b.amount)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge
                    status={b.status.replace('_', ' ')}
                    variantMap={TOUR_STATUS_VARIANT_MAP}
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {STATUS_ACTIONS[b.status] && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isPending}
                        onClick={() =>
                          handleStatusUpdate(b.id, STATUS_ACTIONS[b.status]!)
                        }
                        className="h-7 text-xs rounded-lg"
                      >
                        {STATUS_ACTION_LABELS[b.status]}
                      </Button>
                    )}
                    {b.status !== 'completed' &&
                      b.status !== 'cancelled' &&
                      b.status !== 'no_show' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            handleStatusUpdate(
                              b.id,
                              b.status === 'pending_payment' || b.status === 'confirmed'
                                ? 'no_show'
                                : 'cancelled',
                            )
                          }
                          className="h-7 text-xs rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {b.status === 'pending_payment' || b.status === 'confirmed'
                            ? 'No-show'
                            : 'Cancel'}
                        </Button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {bookings.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{b.student_name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {b.phone}
                </p>
              </div>
              <StatusBadge
                status={b.status.replace('_', ' ')}
                variantMap={TOUR_STATUS_VARIANT_MAP}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                {new Date(b.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {b.preferred_time.charAt(0).toUpperCase() + b.preferred_time.slice(1)}
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {b.zone}
              </div>
              <div className="font-bold text-slate-900">{formatTourPrice(b.amount)}</div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {STATUS_ACTIONS[b.status] && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={isPending}
                  onClick={() =>
                    handleStatusUpdate(b.id, STATUS_ACTIONS[b.status]!)
                  }
                  className="h-8 text-xs rounded-lg flex-1"
                >
                  {STATUS_ACTION_LABELS[b.status]}
                </Button>
              )}
              {b.status !== 'completed' &&
                b.status !== 'cancelled' &&
                b.status !== 'no_show' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                      handleStatusUpdate(
                        b.id,
                        b.status === 'pending_payment' || b.status === 'confirmed'
                          ? 'no_show'
                          : 'cancelled',
                      )
                    }
                    className="h-8 text-xs rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {b.status === 'pending_payment' || b.status === 'confirmed'
                      ? 'No-show'
                      : 'Cancel'}
                  </Button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
