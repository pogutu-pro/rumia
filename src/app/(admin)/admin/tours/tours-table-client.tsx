'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Clock, MapPin, Phone, AlertTriangle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TourCountdown } from '@/components/tour-countdown';
import { updateTourBookingStatusAction } from '@/app/actions/tour-bookings';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import { buildWhatsAppUrl, tourConfirmationMessage } from '@/lib/utils/phone';
import type { TourBookingWithJoins } from '@/types';

interface ToursTableClientProps {
  tours: TourBookingWithJoins[];
  agents: Array<{ id: string; name: string }>;
  zones: string[];
}

const TOUR_STATUS_VARIANT_MAP: Record<string, 'active' | 'pending' | 'rejected' | 'success' | 'draft' | 'info'> = {
  'pending payment': 'pending',
  confirmed: 'info',
  paid: 'success',
  messaged: 'success',
  completed: 'success',
  'no show': 'rejected',
  cancelled: 'rejected',
};

/** Display label for a booking status — contacted shows as "Messaged". */
function tourStatusLabel(status: string): string {
  if (status === 'contacted') return 'Messaged';
  return status.replace(/_/g, ' ');
}

function isActiveStatus(status: string): boolean {
  return status !== 'cancelled' && status !== 'completed' && status !== 'no_show';
}

/** Builds a WhatsApp deep-link that confirms the agent will be there. */
function tourConfirmHref(t: TourBookingWithJoins): string {
  const date = new Date(t.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel =
    t.preferred_time.charAt(0).toUpperCase() + t.preferred_time.slice(1);
  const message = tourConfirmationMessage({
    studentName: t.student_name,
    agentName: t.agents?.name || 'your agent',
    date,
    timeLabel,
    zone: t.zone,
    listingTitle: t.listings?.title || undefined,
    agentPhone: t.agents?.whatsapp || t.agents?.phone || undefined,
  });
  return buildWhatsAppUrl(t.phone, message);
}

export function ToursTableClient({ tours, agents, zones }: ToursTableClientProps) {
  const [localTours, setLocalTours] = useState(tours);
  const [zoneFilter, setZoneFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [isMessaging, setIsMessaging] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const hasActiveFilters = zoneFilter !== '' || agentFilter !== '';

  function clearFilters() {
    setZoneFilter('');
    setAgentFilter('');
  }

  const filtered = localTours.filter((t) => {
    if (zoneFilter && t.zone !== zoneFilter) return false;
    if (agentFilter && t.agent_id !== agentFilter) return false;
    return true;
  });

  /** Opens WhatsApp with the pre-filled confirmation and marks as contacted. */
  async function handleMessage(t: TourBookingWithJoins) {
    window.open(tourConfirmHref(t), '_blank', 'noopener,noreferrer');
    if (t.status === 'contacted') return;

    setMessageError(null);
    setIsMessaging(t.id);
    try {
      const result = await updateTourBookingStatusAction(t.id, 'contacted');
      if (result.success) {
        setLocalTours((prev) =>
          prev.map((x) =>
            x.id === t.id ? { ...x, status: 'contacted' as const } : x,
          ),
        );
      } else {
        setMessageError(result.error);
      }
    } finally {
      setIsMessaging(null);
    }
  }

  return (
    <div>
      <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
        <CalendarCheck className="h-5 w-5" />
        Tour Bookings
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {localTours.length} booking{localTours.length !== 1 ? 's' : ''} total
      </p>

      {messageError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Message failed</p>
            <p className="text-xs text-red-600 mt-0.5">{messageError}</p>
          </div>
          <button
            onClick={() => setMessageError(null)}
            className="ml-auto text-red-400 hover:text-red-600 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-lg">
            Clear
          </Button>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50">
              {['Student', 'Date & Time', 'Zone', 'Type', 'Amount', 'Agent', 'Status', 'Contact'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-sm text-slate-400 text-center px-5 py-8">
                  No tour bookings found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-900">{t.student_name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {t.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-600">
                      {new Date(t.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {t.preferred_time.charAt(0).toUpperCase() + t.preferred_time.slice(1)}
                    </p>
                    {isActiveStatus(t.status) && (
                      <div className="mt-1.5">
                        <TourCountdown
                          preferredDate={t.preferred_date}
                          preferredTime={t.preferred_time as 'morning' | 'afternoon' | 'evening'}
                          compact
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{t.zone}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {t.tour_type === 'specific_hostel' ? 'Hostel' : 'Zone Tour'}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900">
                    {formatTourPrice(t.amount)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {t.agents ? (
                      <Link
                        href={`/admin/agents/${t.agents.id}`}
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        {t.agents.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      status={tourStatusLabel(t.status)}
                      variantMap={TOUR_STATUS_VARIANT_MAP}
                    />
                  </td>
                  <td className="px-5 py-4">
                    {isActiveStatus(t.status) && (
                      <button
                        type="button"
                        onClick={() => handleMessage(t)}
                        disabled={isMessaging === t.id}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {t.status === 'contacted' ? 'Message again' : 'Message'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">
            No tour bookings found.
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.student_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.phone}</p>
                </div>
                <StatusBadge
                  status={tourStatusLabel(t.status)}
                  variantMap={TOUR_STATUS_VARIANT_MAP}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                  {new Date(t.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {t.preferred_time.charAt(0).toUpperCase() + t.preferred_time.slice(1)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {t.zone}
                </div>
                <div className="font-bold text-slate-900">{formatTourPrice(t.amount)}</div>
                {isActiveStatus(t.status) && (
                  <div className="col-span-2">
                    <TourCountdown
                      preferredDate={t.preferred_date}
                      preferredTime={t.preferred_time as 'morning' | 'afternoon' | 'evening'}
                      compact
                    />
                  </div>
                )}
              </div>
              {t.agents && (
                <p className="text-xs text-slate-500">
                  Agent:{' '}
                  <Link
                    href={`/admin/agents/${t.agents.id}`}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    {t.agents.name}
                  </Link>
                </p>
              )}
              {isActiveStatus(t.status) && (
                <button
                  type="button"
                  onClick={() => handleMessage(t)}
                  disabled={isMessaging === t.id}
                  className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <MessageCircle className="h-3 w-3" />
                  {t.status === 'contacted' ? 'Message again' : 'Message'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}