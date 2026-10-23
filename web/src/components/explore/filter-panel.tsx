'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { FilterState, ExploreRefinements } from '@/stores/filter-store';
import type { SearchListing } from '@/lib/search/types';
import { amenityOptions, areaOptions, roomTypeOptions, startingPrice, type Option } from '@/lib/search/explore';

export type ExploreFilters = FilterState & ExploreRefinements;

const BILLS = [
  { value: 'WiFi', label: 'WiFi' },
  { value: 'Water', label: 'Water' },
  { value: 'Electricity', label: 'Electricity' },
];

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The filters in force when the panel opens. */
  current: ExploreFilters;
  /** The listings of the current category (for the options, counts and the price chart). */
  listings: SearchListing[];
  /** How many places a draft would show; drives the "Show N places" button. */
  countFor: (draft: ExploreFilters) => number;
  onApply: (draft: ExploreFilters) => void;
  emptyFilters: ExploreFilters;
}

/**
 * All of Explore's filters in one place, modelled on Airbnb's filter dialog: a bottom sheet on phones, a centred
 * dialog from tablets up, and a footer that always says how many places the choices leave ("Show 23 places") so
 * nobody applies their way into an empty page.
 */
export function FilterPanel({ open, onOpenChange, current, listings, countFor, onApply, emptyFilters }: FilterPanelProps) {
  const [draft, setDraft] = useState<ExploreFilters>(current);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(current); // start from what is applied each time it opens
  }

  const rooms = useMemo(() => roomTypeOptions(listings), [listings]);
  const amenities = useMemo(() => amenityOptions(listings), [listings]);
  const areas = useMemo(() => areaOptions(listings), [listings]);
  const count = countFor(draft);

  const set = (patch: Partial<ExploreFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed z-[100] flex flex-col bg-white shadow-2xl focus:outline-none',
            // Phones: a sheet from the bottom. Tablets up: a centred dialog.
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[88dvh] md:w-[680px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-95',
          )}
        >
          <div className="relative flex h-14 shrink-0 items-center justify-center border-b border-slate-200 px-14">
            <Dialog.Close
              aria-label="Close filters"
              className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="text-base font-semibold text-ink">Filters</Dialog.Title>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
            <Section title="Price per month" hint="Starting rent, before deposit.">
              <PriceRange listings={listings} min={draft.minPrice} max={draft.maxPrice} onChange={(minPrice, maxPrice) => set({ minPrice, maxPrice })} />
            </Section>

            {rooms.length > 0 && (
              <Section title="Room type">
                <Chips options={rooms} selected={draft.roomTypes} onToggle={(v) => set({ roomTypes: toggle(draft.roomTypes, v) })} />
              </Section>
            )}

            <Section title="Distance to campus">
              <Segmented
                value={draft.distance ?? ''}
                onChange={(v) => set({ distance: (v || null) as ExploreFilters['distance'] })}
                options={[
                  { value: '', label: 'Any distance' },
                  { value: 'walk', label: 'Walking distance' },
                  { value: 'near', label: 'Within 2 km' },
                ]}
              />
            </Section>

            <Section title="Bathroom">
              <Segmented
                value={draft.bathroom ?? ''}
                onChange={(v) => set({ bathroom: (v || null) as ExploreFilters['bathroom'] })}
                options={[
                  { value: '', label: 'Any' },
                  { value: 'private', label: 'Private' },
                  { value: 'shared', label: 'Shared' },
                ]}
              />
            </Section>

            <Section title="Bills included in rent">
              <Chips
                options={BILLS.map((b) => ({ ...b, count: -1 }))}
                selected={draft.amenities}
                onToggle={(v) => set({ amenities: toggle(draft.amenities, v) })}
              />
            </Section>

            <Section title="Who it's for">
              <Chips
                options={[
                  { value: 'female', label: 'Ladies only', count: -1 },
                  { value: 'male', label: 'Gents only', count: -1 },
                ]}
                selected={draft.genders}
                onToggle={(v) => set({ genders: toggle(draft.genders, v) })}
              />
            </Section>

            {amenities.length > 0 && (
              <Section title="Amenities">
                <Chips options={amenities} selected={draft.amenities} onToggle={(v) => set({ amenities: toggle(draft.amenities, v) })} />
              </Section>
            )}

            {areas.length > 1 && (
              <Section title="Area" last>
                <Chips options={areas} selected={draft.zones} onToggle={(v) => set({ zones: toggle(draft.zones, v) })} />
              </Section>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <button
              type="button"
              onClick={() => setDraft({ ...emptyFilters, sort: draft.sort })}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold text-ink underline underline-offset-4 hover:bg-slate-50"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink px-6 text-[15px] font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
              disabled={count === 0}
            >
              {count === 0 ? 'No places match' : `Show ${count} ${count === 1 ? 'place' : 'places'}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, hint, children, last }: { title: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cn('py-6', !last && 'border-b border-slate-200')}>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active ? 'bg-white text-ink shadow-sm ring-1 ring-black/5' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-ink hover:border-ink',
            )}
          >
            {o.label}
            {o.count >= 0 && <span className={cn('text-xs', active ? 'text-white/70' : 'text-ink-muted')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const BUCKETS = 16;

/** Min/max inputs over a small histogram of real starting prices, the way Airbnb shows its price range. */
function PriceRange({
  listings,
  min,
  max,
  onChange,
}: {
  listings: SearchListing[];
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const prices = useMemo(() => listings.map(startingPrice).filter((p) => p > 0), [listings]);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const step = Math.max(1, (hi - lo) / BUCKETS);
  const bars = useMemo(() => {
    const b = new Array(BUCKETS).fill(0);
    for (const p of prices) b[Math.min(BUCKETS - 1, Math.floor((p - lo) / step))]++;
    return b;
  }, [prices, lo, step]);
  const tallest = Math.max(1, ...bars);
  const parse = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, ''));
    return v.trim() && n > 0 ? n : null;
  };
  const presets: { label: string; min: number | null; max: number | null }[] = [
    { label: 'Under KES 5,000', min: null, max: 5000 },
    { label: 'KES 5,000 – 8,000', min: 5000, max: 8000 },
    { label: 'KES 8,000+', min: 8000, max: null },
  ];

  return (
    <div>
      {prices.length > 3 && (
        <div className="flex h-14 items-end gap-[3px]" aria-hidden>
          {bars.map((n, i) => {
            const from = lo + i * step;
            const inRange = (min === null || from + step > min) && (max === null || from <= max);
            return (
              <div
                key={i}
                className={cn('flex-1 rounded-t-sm', inRange ? 'bg-ink' : 'bg-slate-200')}
                style={{ height: `${Math.max(6, (n / tallest) * 100)}%` }}
              />
            );
          })}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <PriceInput label="Minimum" value={min} placeholder={lo ? lo.toLocaleString() : 'Any'} onChange={(v) => onChange(parse(v), max)} />
        <PriceInput label="Maximum" value={max} placeholder={hi ? hi.toLocaleString() : 'Any'} onChange={(v) => onChange(min, parse(v))} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = min === p.min && max === p.max;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => (active ? onChange(null, null) : onChange(p.min, p.max))}
              className={cn(
                'min-h-9 rounded-full border px-3 text-[13px] font-medium transition-colors',
                active ? 'border-ink bg-ink text-white' : 'border-slate-300 text-ink hover:border-ink',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceInput({ label, value, placeholder, onChange }: { label: string; value: number | null; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="block rounded-xl border border-slate-300 px-3 py-2 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
      <span className="block text-xs text-ink-muted">{label}</span>
      <span className="flex items-baseline gap-1 text-base text-ink">
        <span className="text-sm text-ink-muted">KES</span>
        <input
          inputMode="numeric"
          value={value === null ? '' : value.toLocaleString()}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}
