'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Clock, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { updateTourBookingStatusAction } from '@/app/actions/tour-bookings';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import type { TourBookingWithJoins, TourStatus } from '@/types';

interface ToursTableClientProps {
  tours: TourBookingWithJoins[];
  agents: Array<{ id: string; name: string }>;
  zones: string[];
}

const TOUR_STATUS_VARIANT_MAP: Record<string, 'active' | 'pending' | 'rejected' | 'success' | 'draft' | 'info'> = {
  pending_payment: 'pending',
  confirmed: 'info',
  paid: 'success',
  completed: 'success',
  no_show: 'rejected',
  cancelled: 'rejected',
};

const STATUS_OPTIONS: TourStatus[] = [
  'pending_payment',
  'confirmed',
  'paid',
  'completed',
  'no_show',
  'cancelled',
];

export function ToursTableClient({ tours, agents, zones }: ToursTableClientProps) {
  const [statusFilter, setStatusFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const hasActiveFilters = statusFilter !== '' || zoneFilter !== '' || agentFilter !== '';

  function clearFilters() {
    setStatusFilter('');
    setZoneFilter('');
    setAgentFilter('');
  }

  const filtered = tours.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (zoneFilter && t.zone !== zoneFilter) return false;
    if (agentFilter && t.agent_id !== agentFilter) return false;
    return true;
  });

  async function handleStatusUpdate(bookingId: string, newStatus: TourStatus) {
    setIsUpdating(bookingId);
    try {
      await updateTourBookingStatusAction(bookingId, newStatus);
    } finally {
      setIsUpdating(null);
    }
  }

  // Identify overdue pending_payment bookings (past their scheduled date)
  const today = new Date().toISOString().split('T')[0];
  const overdueBookings = tours.filter(
    (t) => t.status === 'pending_payment' && t.preferred_date < today,
  );

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <CalendarCheck className="h-5 w-5" />
        Tour Bookings
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {tours.length} booking{tours.length !== 1 ? 's' : ''} total
      </p>

      {/* Overdue warning */}
      {overdueBookings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {overdueBookings.length} booking{overdueBookings.length !== 1 ? 's' : ''} stuck in Pending Payment past their scheduled date
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Review these bookings below — they may need follow-up.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
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

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Student', 'Date & Time', 'Zone', 'Type', 'Amount', 'Agent', 'Status', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-5 py-3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-sm text-gray-400 text-center px-5 py-8">
                  No tour bookings found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    t.status === 'pending_payment' && t.preferred_date < today
                      ? 'bg-amber-50/50'
                      : ''
                  }`}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-900">{t.student_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {t.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-600">
                      {new Date(t.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {t.preferred_time.charAt(0).toUpperCase() + t.preferred_time.slice(1)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.zone}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {t.tour_type === 'specific_hostel' ? 'Specific' : 'Full Search'}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">
                    {formatTourPrice(t.amount)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {t.agents ? (
                      <Link
                        href={`/admin/agents/${t.agents.id}`}
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        {t.agents.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      status={t.status.replace('_', ' ')}
                      variantMap={TOUR_STATUS_VARIANT_MAP}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={t.status}
                      disabled={isUpdating === t.id}
                      onChange={(e) =>
                        handleStatusUpdate(t.id, e.target.value as TourStatus)
                      }
                      className="h-8 rounded-lg border border-gray-200 bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center text-sm text-gray-400 shadow-sm">
            No tour bookings found.
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3 ${
                t.status === 'pending_payment' && t.preferred_date < today
                  ? 'border-l-4 border-l-amber-400'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.student_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.phone}</p>
                </div>
                <StatusBadge
                  status={t.status.replace('_', ' ')}
                  variantMap={TOUR_STATUS_VARIANT_MAP}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <CalendarCheck className="h-3.5 w-3.5 text-gray-400" />
                  {new Date(t.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  {t.preferred_time.charAt(0).toUpperCase() + t.preferred_time.slice(1)}
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  {t.zone}
                </div>
                <div className="font-bold text-gray-900">{formatTourPrice(t.amount)}</div>
              </div>
              {t.agents && (
                <p className="text-xs text-gray-500">
                  Agent:{' '}
                  <Link
                    href={`/admin/agents/${t.agents.id}`}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    {t.agents.name}
                  </Link>
                </p>
              )}
              <select
                value={t.status}
                disabled={isUpdating === t.id}
                onChange={(e) =>
                  handleStatusUpdate(t.id, e.target.value as TourStatus)
                }
                className="w-full h-9 rounded-lg border border-gray-200 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
