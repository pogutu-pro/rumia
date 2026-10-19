'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Search, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { parseSearch, searchQuery, shortRange, type StaySearch } from '@/lib/site/stay-search';
import { cn } from '@/lib/utils/cn';
import { StayCalendar } from './stay-calendar';
import { GuestsStepper } from './guests-stepper';

type Step = 'where' | 'when' | 'who';

function summary(s: StaySearch) {
  return {
    where: s.where || 'Anywhere',
    when: s.checkIn && s.checkOut ? shortRange(s.checkIn, s.checkOut) : s.checkIn ? 'Add check-out' : 'Any week',
    who: s.guests ? `${s.guests} guest${s.guests === 1 ? '' : 's'}` : 'Add guests',
  };
}

/**
 * Where / When / Who, as on Airbnb: a pill in the header that opens a panel on wide screens and a full-screen sheet on
 * phones. Searching goes to /stays with the choice in the URL; the stays then show totals for those dates.
 */
export function SearchBar({ places }: { places: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = parseSearch(params);
  const [draft, setDraft] = useState<StaySearch>(current);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('where');
  const [mobile, setMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function openAt(s: Step) {
    setDraft(parseSearch(params));
    setStep(s);
    setMobile(window.innerWidth < 768);
    setOpen(true);
  }

  // Wide screens: close the panel on Escape or a click outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!mobile && panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, mobile]);

  function submit() {
    setOpen(false);
    router.push(`/stays${searchQuery({ ...draft, type: current.type })}`);
  }

  const shown = summary(current);
  const matches = places.filter((p) => !draft.where || p.toLowerCase().includes(draft.where.toLowerCase())).slice(0, 6);

  const whereField = (
    <div>
      <label className="block">
        <span className="sr-only">Where</span>
        <span className="flex items-center gap-2 rounded-xl border border-bnb-line bg-white px-3 focus-within:border-bnb-ink">
          <Search className="h-4 w-4 text-bnb-stone" aria-hidden />
          <input
            autoFocus={step === 'where'}
            value={draft.where}
            onChange={(e) => setDraft({ ...draft, where: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setStep('when')}
            placeholder="Search a town or area"
            className="h-12 w-full bg-transparent text-base text-bnb-ink outline-none placeholder:text-bnb-stone focus:outline-none focus-visible:outline-none"
          />
          {draft.where && (
            <button type="button" onClick={() => setDraft({ ...draft, where: '' })} aria-label="Clear place" className="text-bnb-stone">
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </label>
      {matches.length > 0 && (
        <ul className="mt-3 space-y-1">
          {matches.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...draft, where: p });
                  setStep('when');
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-bnb-mist"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-bnb-mist text-bnb-ink">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-bnb-ink">{p}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const actions = (
    <div className="flex items-center justify-between gap-3 border-t border-bnb-line pt-4">
      <button
        type="button"
        onClick={() => setDraft({ where: '', checkIn: null, checkOut: null, guests: 0, type: 'all' })}
        className="text-sm font-semibold text-bnb-ink underline underline-offset-4"
      >
        Clear all
      </button>
      <button type="button" onClick={submit} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-bnb-forest px-6 font-semibold text-white hover:bg-bnb-pine">
        <Search className="h-4 w-4" aria-hidden /> Search
      </button>
    </div>
  );

  const segment = (s: Step, label: string, value: string, extra = '') => (
    <button
      type="button"
      onClick={() => openAt(s)}
      className={cn(
        'min-w-0 flex-1 rounded-full px-5 py-2 text-left transition-colors hover:bg-bnb-mist',
        open && step === s && 'bg-white shadow-[0_6px_20px_rgba(16,24,40,0.12)] hover:bg-white',
        extra,
      )}
    >
      <span className="block text-xs font-semibold text-bnb-ink">{label}</span>
      <span className="block truncate text-sm text-bnb-stone">{value}</span>
    </button>
  );

  return (
    <>
      {/* Phones */}
      <button
        type="button"
        onClick={() => openAt('where')}
        className="flex w-full items-center gap-3 rounded-full border border-bnb-line bg-white px-4 py-2.5 text-left shadow-[0_3px_12px_rgba(16,24,40,0.08)] md:hidden"
      >
        <Search className="h-5 w-5 shrink-0 text-bnb-ink" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-bnb-ink">{current.where || 'Where to?'}</span>
          <span className="block truncate text-xs text-bnb-stone">
            {shown.when} · {shown.who}
          </span>
        </span>
      </button>

      {/* Wide screens */}
      <div ref={panelRef} className="relative hidden md:block">
        <div className={cn('flex items-center rounded-full border border-bnb-line bg-white shadow-[0_3px_12px_rgba(16,24,40,0.08)]', open && 'bg-bnb-mist')}>
          {segment('where', 'Where', shown.where)}
          <span className="h-8 w-px bg-bnb-line" aria-hidden />
          {segment('when', 'When', shown.when)}
          <span className="h-8 w-px bg-bnb-line" aria-hidden />
          {segment('who', 'Who', shown.who, 'pr-2')}
          <button type="button" onClick={open ? submit : () => openAt('where')} aria-label="Search" className="m-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bnb-forest text-white hover:bg-bnb-pine">
            <Search className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {open && !mobile && (
          <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(46rem,92vw)] -translate-x-1/2 rounded-[2rem] border border-bnb-line bg-white p-6 shadow-[0_18px_50px_rgba(16,24,40,0.18)]">
            {step === 'where' && whereField}
            {step === 'when' && (
              <StayCalendar
                months={2}
                checkIn={draft.checkIn}
                checkOut={draft.checkOut}
                onChange={(a, b) => {
                  setDraft({ ...draft, checkIn: a, checkOut: b });
                  if (a && b) setStep('who');
                }}
              />
            )}
            {step === 'who' && (
              <div className="mx-auto max-w-sm py-2">
                <GuestsStepper value={draft.guests} onChange={(n) => setDraft({ ...draft, guests: n })} hint="Adults and children" />
              </div>
            )}
            <div className="mt-5">{actions}</div>
          </div>
        )}
      </div>

      {/* Phone sheet */}
      <Drawer open={open && mobile} onOpenChange={setOpen}>
        <DrawerContent className="h-[94dvh] bg-bnb-mist">
          <DrawerTitle className="sr-only">Search stays</DrawerTitle>
          <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-2">
            {(['where', 'when', 'who'] as Step[]).map((s) => {
              const titles = { where: 'Where to?', when: 'When is your trip?', who: "Who's coming?" };
              const values = summary(draft);
              if (step !== s) {
                return (
                  <button key={s} type="button" onClick={() => setStep(s)} className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-left shadow-sm">
                    <span className="text-sm text-bnb-stone">{s === 'where' ? 'Where' : s === 'when' ? 'When' : 'Who'}</span>
                    <span className="text-sm font-semibold text-bnb-ink">{values[s]}</span>
                  </button>
                );
              }
              return (
                <section key={s} className="rounded-3xl bg-white p-5 shadow-md">
                  <h2 className="mb-4 font-bnb-display text-2xl font-bold text-bnb-ink">{titles[s]}</h2>
                  {s === 'where' && whereField}
                  {s === 'when' && (
                    <StayCalendar
                      checkIn={draft.checkIn}
                      checkOut={draft.checkOut}
                      onChange={(a, b) => {
                        setDraft({ ...draft, checkIn: a, checkOut: b });
                        if (a && b) setStep('who');
                      }}
                    />
                  )}
                  {s === 'who' && <GuestsStepper value={draft.guests} onChange={(n) => setDraft({ ...draft, guests: n })} hint="Adults and children" />}
                </section>
              );
            })}
            <div className="mt-auto">{actions}</div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
