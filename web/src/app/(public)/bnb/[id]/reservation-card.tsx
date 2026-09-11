'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/utils/phone';
import { formatCurrency } from '@/lib/utils/currency';

interface ReservationCardProps {
  listingTitle: string;
  location?: string | null;
  price: number;
  priceUnit: string;
  hostPhone: string;
  cleaningFee?: number | null;
  securityDeposit?: number | null;
  extraGuestFee?: number | null;
  minStayNights?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  compact?: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ReservationCard({
  listingTitle,
  location,
  price,
  priceUnit,
  hostPhone,
  cleaningFee,
  securityDeposit,
  extraGuestFee,
  minStayNights,
  availableFrom,
  availableUntil,
  compact = false,
}: ReservationCardProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const minimumDate = useMemo(() => today(), []);
  const hasPhone = Boolean(hostPhone.trim());

  function reserve() {
    if (!hasPhone) return;
    const dates =
      checkIn && checkOut
        ? ` I would like to check in on ${checkIn} and check out on ${checkOut}.`
        : '';
    const message = [
      `Hi, I found ${listingTitle} on RumiaBnB${location ? ` in ${location}` : ''}.`,
      `I would like to ask about reserving it.${dates}`,
      `The listed price is ${formatCurrency(price)} ${priceUnit}. Is it available?`,
    ].join(' ');
    window.open(
      buildWhatsAppUrl(hostPhone, message),
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <div
      className={
        compact
          ? 'space-y-3'
          : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)]'
      }
    >
      {!compact && (
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-3xl font-black tracking-tight text-slate-950">
              {formatCurrency(price)}
            </span>
            <span className="ml-1.5 text-sm font-semibold text-slate-500">
              {priceUnit}
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Ask before booking
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-300">
        <label className="border-r border-slate-300 px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Check-in
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              min={minimumDate}
              max={availableUntil ?? undefined}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="min-w-0 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
              aria-label="Check-in date"
            />
          </span>
        </label>
        <label className="px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Check-out
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              min={checkIn || minimumDate}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className="min-w-0 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
              aria-label="Check-out date"
            />
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={reserve}
        disabled={!hasPhone}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <MessageCircle className="h-4 w-4" />
        Reserve via WhatsApp
      </button>

      {!compact && (
        <div className="space-y-1.5 text-xs text-slate-500">
          {minStayNights && minStayNights > 1 && (
            <p>Minimum stay: {minStayNights} nights</p>
          )}
          {availableFrom && <p>Available from {availableFrom}</p>}
          {cleaningFee && cleaningFee > 0 && (
            <p>Cleaning fee: {formatCurrency(cleaningFee)}</p>
          )}
          {securityDeposit && securityDeposit > 0 && (
            <p>Security deposit: {formatCurrency(securityDeposit)}</p>
          )}
          {extraGuestFee && extraGuestFee > 0 && (
            <p>Extra guest fee: {formatCurrency(extraGuestFee)}</p>
          )}
        </div>
      )}
    </div>
  );
}
