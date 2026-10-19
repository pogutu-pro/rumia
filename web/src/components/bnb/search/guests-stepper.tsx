'use client';

import { Minus, Plus } from 'lucide-react';

/** Guests count with − / + buttons. */
export function GuestsStepper({ value, onChange, max = 16, label = 'Guests', hint }: { value: number; onChange: (n: number) => void; max?: number; label?: string; hint?: string }) {
  const btn =
    'grid h-9 w-9 place-items-center rounded-full border border-bnb-line text-bnb-ink transition-colors hover:border-bnb-ink disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-bnb-ink">{label}</p>
        {hint && <p className="text-sm text-bnb-stone">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Fewer guests">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-6 text-center tabular-nums text-bnb-ink" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More guests">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
