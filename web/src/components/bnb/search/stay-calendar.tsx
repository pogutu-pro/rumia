'use client';

import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fromIso(s: string | null): Date | undefined {
  return s ? new Date(`${s}T00:00:00`) : undefined;
}

/** Check-in and check-out in one calendar, as on booking sites. Past days and days outside the stay's window are off. */
export function StayCalendar({
  checkIn,
  checkOut,
  onChange,
  months = 1,
  availableFrom,
  availableUntil,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
  months?: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = availableFrom ? fromIso(availableFrom)! : today;
  const start = from > today ? from : today;
  const selected: DateRange | undefined = checkIn ? { from: fromIso(checkIn), to: fromIso(checkOut) } : undefined;

  return (
    <div className="bnb-calendar flex justify-center">
      <DayPicker
        mode="range"
        numberOfMonths={months}
        weekStartsOn={1}
        defaultMonth={fromIso(checkIn) ?? start}
        startMonth={start}
        selected={selected}
        min={1}
        excludeDisabled
        disabled={[{ before: start }, ...(availableUntil ? [{ after: fromIso(availableUntil)! }] : [])]}
        onSelect={(range, day) => {
          // A new click after a complete range starts a new range, like Airbnb.
          if (checkIn && checkOut) return onChange(iso(day), null);
          onChange(range?.from ? iso(range.from) : null, range?.to ? iso(range.to) : null);
        }}
      />
    </div>
  );
}
