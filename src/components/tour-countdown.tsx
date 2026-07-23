'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';
import type { TourTimeWindow } from '@/types';

const TIME_WINDOW_HOURS: Record<TourTimeWindow, number> = {
  morning: 8,
  afternoon: 13,
  evening: 17,
};

function getArrivalTimestamp(preferredDate: string, preferredTime: TourTimeWindow): number {
  const hours = TIME_WINDOW_HOURS[preferredTime];
  const date = new Date(preferredDate + 'T00:00:00');
  date.setHours(hours, 0, 0, 0);
  return date.getTime();
}

function formatCountdown(ms: number): { value: string; label: string }[] {
  if (ms <= 0) return [];

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: { value: string; label: string }[] = [];

  if (days > 0) parts.push({ value: String(days), label: days === 1 ? 'day' : 'days' });
  if (hours > 0 || days > 0) parts.push({ value: String(hours), label: hours === 1 ? 'hr' : 'hrs' });
  parts.push({ value: String(minutes), label: minutes === 1 ? 'min' : 'min' });
  if (days === 0) parts.push({ value: String(seconds), label: 'sec' });

  return parts;
}

interface TourCountdownProps {
  preferredDate: string;
  preferredTime: TourTimeWindow;
  compact?: boolean;
}

export function TourCountdown({ preferredDate, preferredTime, compact }: TourCountdownProps) {
  const [remaining, setRemaining] = useState<number>(() => {
    const arrival = getArrivalTimestamp(preferredDate, preferredTime);
    return Math.max(0, arrival - Date.now());
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const arrival = getArrivalTimestamp(preferredDate, preferredTime);
      setRemaining(Math.max(0, arrival - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [preferredDate, preferredTime]);

  const parts = formatCountdown(remaining);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
        <Timer className="h-3 w-3" />
        Tour time
      </span>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
        <Timer className="h-3 w-3 text-slate-400" />
        {parts.map((p, i) => (
          <span key={p.label}>
            {i > 0 && ' '}
            {p.value}{p.label}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Timer className="h-3 w-3 text-slate-400" />
      <div className="flex items-center gap-1">
        {parts.map((p, i) => (
          <span key={p.label} className="inline-flex items-baseline gap-0.5">
            {i > 0 && <span className="text-slate-300 text-[10px]">:</span>}
            <span className="text-xs font-bold text-slate-700 tabular-nums">{p.value}</span>
            <span className="text-[10px] text-slate-400 font-medium">{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
