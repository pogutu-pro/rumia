'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { rumia } from '@/lib/api/rumia';
import { track } from '@/lib/events';
import {
  chipsFor, filtersHref, toApiQuery, withoutChip, type Chip, type ExploreFilters,
} from '@/lib/rumia/explore-params';
import { Sheet } from './sheet';

interface Named {
  slug: string;
  name: string;
  listing_count?: number;
}

interface Props {
  filters: ExploreFilters;
  places: Named[];
  landmarks: Named[];
  total: number;
}

const PRICE_STEPS_MONTHLY = [0, 3000, 5000, 8000, 12000, 20000, 30000, 50000];
const UNIT_OPTIONS_MONTHLY: Array<[string, string]> = [
  ['bedsitter', 'Bedsitter'], ['single_room', 'Single room'], ['shared_room', 'Shared room'], ['studio', 'Studio'],
  ['one_bed', '1 bedroom'], ['two_bed', '2 bedrooms'], ['three_bed_plus', '3+ bedrooms'],
];
const KINDS: Array<[string, string]> = [['', 'Any'], ['hostel', 'Hostel'], ['apartment', 'Apartment'], ['house', 'House']];
const AMENITIES: Array<[string, string]> = [['wifi', 'Wi-Fi'], ['water', 'Water'], ['parking', 'Parking'], ['security', 'Security'], ['furnished', 'Furnished']];

type Panel = null | 'area' | 'price' | 'type' | 'more';

export function ExploreControls({ filters, places, landmarks, total }: Props) {
  const router = useRouter();
  const [text, setText] = useState(filters.q);
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<ExploreFilters>(filters);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  // Keep the box in step when the URL changes (chip removed, back button).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q);
  }

  const go = useCallback((next: Partial<ExploreFilters>) => router.push(filtersHref(next), { scroll: false }), [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    track('search_performed', { surface: 'explore', market: 'nyeri', props: { q: text.slice(0, 80), places: filters.place, mode: filters.mode } });
    go({ ...filters, q: text.trim() });
  }

  // Live "Show N places" in the sheet: ask the API how many the draft would return.
  useEffect(() => {
    if (!panel) return;
    const timer = setTimeout(async () => {
      const { data } = await rumia
        .GET('/api/v1/discovery/search', { params: { query: { ...toApiQuery(draft, { limit: 1 }) } } })
        .catch(() => ({ data: undefined }));
      setDraftCount(data ? data.total : null);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, panel]);

  function openPanel(p: Exclude<Panel, null>) {
    setDraft(filters);
    setDraftCount(total);
    setPanel(p);
  }

  function apply() {
    track('intent_set', { surface: 'explore', market: 'nyeri', props: { places: draft.place, max_price: draft.max_price, unit_kind: draft.unit_kind } });
    setPanel(null);
    go(draft);
  }

  const chips: Chip[] = useMemo(() => chipsFor(filters, places, landmarks), [filters, places, landmarks]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const nightly = filters.mode === 'nightly';

  const label = {
    area: filters.place.length ? (filters.place.length === 1 ? (places.find((p) => p.slug === filters.place[0])?.name ?? 'Area') : `${filters.place.length} areas`) : 'Area',
    price: filters.max_price || filters.min_price ? `${filters.min_price ? `${Number(filters.min_price) / 1000}k` : '0'}–${filters.max_price ? `${Number(filters.max_price) / 1000}k` : 'any'}` : 'Price',
    type: filters.kind || filters.unit_kind.length ? [filters.kind && filters.kind, ...filters.unit_kind.slice(0, 1)].filter(Boolean).join(', ') : 'Type',
  };

  const chipBtn = (name: Exclude<Panel, null>, text: string, active: boolean) => (
    <button
      key={name}
      type="button"
      onClick={() => openPanel(name)}
      aria-haspopup="dialog"
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium capitalize ${
        active ? 'border-rum-accent bg-rum-accent/10 text-rum-accent-strong' : 'border-rum-line bg-rum-raised text-rum-text'
      }`}
    >
      {name === 'more' && <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
      {text}
    </button>
  );

  return (
    <div className="space-y-3">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <label htmlFor="explore-q" className="sr-only">Search places</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rum-muted" aria-hidden="true" />
          <input
            id="explore-q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try “bedsitter near DeKUT under 8k”"
            enterKeyHint="search"
            autoComplete="off"
            className="min-h-12 w-full rounded-rum-control border border-rum-line bg-rum-raised pl-10 pr-3 text-base text-rum-text placeholder:text-rum-muted"
          />
        </div>
        <button type="submit" className="min-h-12 rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent">
          Search
        </button>
      </form>

      <div role="group" aria-label="Rent type" className="inline-flex rounded-full border border-rum-line bg-rum-raised p-1 text-sm">
        {(['monthly', 'nightly'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={filters.mode === m}
            onClick={() => go({ ...filters, mode: m, unit_kind: [], min_price: '', max_price: '' })}
            className={`min-h-9 rounded-full px-4 font-medium ${filters.mode === m ? 'bg-rum-accent text-rum-on-accent' : 'text-rum-text'}`}
          >
            {m === 'monthly' ? 'Rent monthly' : 'Stay a few nights'}
          </button>
        ))}
      </div>

      <div className="rum-scroll-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {chipBtn('area', label.area, filters.place.length > 0)}
        {chipBtn('price', label.price, Boolean(filters.min_price || filters.max_price))}
        {chipBtn('type', label.type, Boolean(filters.kind || filters.unit_kind.length))}
        {chipBtn('more', 'More', Boolean(filters.amenities.length || filters.has_video || filters.gender || filters.near))}
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Applied filters">
          {chips.map((c) => (
            <li key={`${c.key}-${c.value ?? ''}`}>
              <button
                type="button"
                onClick={() => go(withoutChip(filters, c))}
                aria-label={`Remove ${c.label}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-rum-sunken px-3 text-sm text-rum-text"
              >
                {c.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={panel !== null}
        title={{ area: 'Area', price: 'Price', type: 'Type', more: 'More filters', '': '' }[panel ?? ''] ?? ''}
        onClose={() => setPanel(null)}
        footer={
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDraft({ ...draft, place: [], min_price: '', max_price: '', kind: '', unit_kind: [], amenities: [], has_video: '', gender: '', near: '' })} className="min-h-11 px-2 text-sm underline">
              Clear all
            </button>
            <button type="button" onClick={apply} className="min-h-12 flex-1 rounded-rum-control bg-rum-accent px-4 text-base font-semibold text-rum-on-accent">
              {draftCount === null ? 'Show places' : draftCount === 0 ? 'No places match' : `Show ${draftCount} place${draftCount === 1 ? '' : 's'}`}
            </button>
          </div>
        }
      >
        {panel === 'area' && (
          <ul className="space-y-1">
            {places.map((p) => (
              <li key={p.slug}>
                <label className="flex min-h-11 items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <input type="checkbox" checked={draft.place.includes(p.slug)} onChange={() => setDraft({ ...draft, place: toggle(draft.place, p.slug) })} className="h-5 w-5 accent-rum-accent" />
                    {p.name}
                  </span>
                  {p.listing_count !== undefined && <span className="text-sm text-rum-muted">{p.listing_count}</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
        {panel === 'price' && (
          <div className="space-y-4">
            <p className="text-sm text-rum-muted">{nightly ? 'Per night' : 'Per month'}, in Kenya shillings.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['min_price', 'max_price'] as const).map((k) => (
                <label key={k} className="text-sm">
                  <span className="text-rum-muted">{k === 'min_price' ? 'From' : 'Up to'}</span>
                  <input inputMode="numeric" pattern="[0-9]*" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value.replace(/\D/g, '') })} placeholder={k === 'min_price' ? '0' : 'Any'} className="rum-price mt-1 min-h-12 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-base" />
                </label>
              ))}
            </div>
            {!nightly && (
              <div className="flex flex-wrap gap-2">
                {PRICE_STEPS_MONTHLY.slice(1).map((v) => (
                  <button key={v} type="button" onClick={() => setDraft({ ...draft, max_price: String(v) })} className={`min-h-9 rounded-full border px-3 text-sm ${draft.max_price === String(v) ? 'border-rum-accent bg-rum-accent/10' : 'border-rum-line'}`}>
                    Up to {v / 1000}k
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {panel === 'type' && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Kind of place</legend>
              <div className="flex flex-wrap gap-2">
                {KINDS.map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={draft.kind === v} onClick={() => setDraft({ ...draft, kind: v })} className={`min-h-11 rounded-full border px-4 text-sm ${draft.kind === v ? 'border-rum-accent bg-rum-accent/10 font-semibold' : 'border-rum-line'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
            {!nightly && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Room type</legend>
                <p className="mb-2 text-sm text-rum-muted">A bedsitter is one room with a sleeping and living area; a single room shares facilities.</p>
                <div className="flex flex-wrap gap-2">
                  {UNIT_OPTIONS_MONTHLY.map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={draft.unit_kind.includes(v)} onClick={() => setDraft({ ...draft, unit_kind: toggle(draft.unit_kind, v) })} className={`min-h-11 rounded-full border px-4 text-sm ${draft.unit_kind.includes(v) ? 'border-rum-accent bg-rum-accent/10 font-semibold' : 'border-rum-line'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}
        {panel === 'more' && (
          <div className="space-y-5">
            {landmarks.length > 0 && (
              <label className="block text-sm">
                <span className="font-semibold">Close to</span>
                <select value={draft.near} onChange={(e) => setDraft({ ...draft, near: e.target.value })} className="mt-1 min-h-12 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-base">
                  <option value="">Anywhere</option>
                  {landmarks.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                </select>
              </label>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Included</legend>
              <div className="space-y-1">
                {AMENITIES.map(([v, l]) => (
                  <label key={v} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" checked={draft.amenities.includes(v)} onChange={() => setDraft({ ...draft, amenities: toggle(draft.amenities, v) })} className="h-5 w-5 accent-rum-accent" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={draft.has_video === 'true'} onChange={(e) => setDraft({ ...draft, has_video: e.target.checked ? 'true' : '' })} className="h-5 w-5 accent-rum-accent" />
              Has a video
            </label>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Hostels for</legend>
              <div className="flex gap-2">
                {([['', 'Anyone'], ['women', 'Women'], ['men', 'Men']] as const).map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={draft.gender === v} onClick={() => setDraft({ ...draft, gender: v })} className={`min-h-11 rounded-full border px-4 text-sm ${draft.gender === v ? 'border-rum-accent bg-rum-accent/10 font-semibold' : 'border-rum-line'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Sheet>
    </div>
  );
}
