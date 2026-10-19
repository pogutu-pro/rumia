'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { BnbStay } from '@/lib/site/bnb-api';
import { kes } from '@/lib/site/stay-format';
import { estimateTotal, nightsBetween, parseSearch, searchQuery, shortRange } from '@/lib/site/stay-search';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { StayCalendar } from './search/stay-calendar';
import { GuestsStepper } from './search/guests-stepper';
import { ConciergeButton } from './concierge-button';
import { cn } from '@/lib/utils/cn';

const BASIS = { night: '', week: ' (weekly rate)', month: ' (monthly rate)' } as const;

function fmt(d: string | null): string {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Add date';
}

/**
 * Dates, guests and the full price for them. "Request to book" goes to the confirmation page; nothing is charged.
 * A card that follows the page on wide screens; a price bar with a sheet on phones.
 */
export function BookingCard({ stay, ident }: { stay: BnbStay; ident: string }) {
  const router = useRouter();
  const initial = parseSearch(useSearchParams());
  const b = stay.bnb;
  const maxGuests = b?.max_guests || 16;
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(Math.min(Math.max(initial.guests || 1, 1), maxGuests));
  const [picker, setPicker] = useState<'dates' | 'guests' | null>(null);
  const [sheet, setSheet] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const total = estimateTotal(stay, nights);
  const tooShort = !!(nights && b?.min_stay_nights && nights < b.min_stay_nights);
  const ready = nights > 0 && !tooShort;

  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent) => cardRef.current && !cardRef.current.contains(e.target as Node) && setPicker(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [picker]);

  function setDates(a: string | null, z: string | null) {
    setCheckIn(a);
    setCheckOut(z);
    if (a && z) setPicker('guests');
  }

  function book() {
    if (!ready) return setPicker('dates');
    router.push(`/stay/${encodeURIComponent(ident)}/book${searchQuery({ checkIn, checkOut, guests })}`);
  }

  const breakdown = total && (
    <dl className="space-y-3 text-bnb-ink">
      <div className="flex justify-between gap-4">
        <dt className="underline decoration-bnb-line underline-offset-4">
          {kes(Math.round(total.room / nights))} × {nights} {nights === 1 ? 'night' : 'nights'}
          {BASIS[total.basis]}
        </dt>
        <dd>{kes(total.room)}</dd>
      </div>
      {total.cleaning > 0 && (
        <div className="flex justify-between gap-4">
          <dt className="underline decoration-bnb-line underline-offset-4">Cleaning fee</dt>
          <dd>{kes(total.cleaning)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t border-bnb-line pt-3 font-semibold">
        <dt>Total</dt>
        <dd>{kes(total.total)}</dd>
      </div>
    </dl>
  );

  const fields = (
    <div className="rounded-xl border border-bnb-stone/50">
      <button type="button" onClick={() => setPicker(picker === 'dates' ? null : 'dates')} className="grid w-full grid-cols-2 text-left">
        <span className="border-r border-bnb-stone/50 px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-bnb-ink">Check-in</span>
          <span className={cn('block text-sm', checkIn ? 'text-bnb-ink' : 'text-bnb-stone')}>{fmt(checkIn)}</span>
        </span>
        <span className="px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-bnb-ink">Checkout</span>
          <span className={cn('block text-sm', checkOut ? 'text-bnb-ink' : 'text-bnb-stone')}>{fmt(checkOut)}</span>
        </span>
      </button>
      <button type="button" onClick={() => setPicker(picker === 'guests' ? null : 'guests')} className="flex w-full items-center justify-between border-t border-bnb-stone/50 px-3 py-2.5 text-left">
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-bnb-ink">Guests</span>
          <span className="block text-sm text-bnb-ink">
            {guests} guest{guests === 1 ? '' : 's'}
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-bnb-ink transition-transform', picker === 'guests' && 'rotate-180')} aria-hidden />
      </button>
    </div>
  );

  const priceLine = (
    <p className="text-bnb-ink">
      {total && ready ? (
        <>
          <span className="font-bnb-display text-2xl font-bold">{kes(total.total)}</span>{' '}
          <span className="text-bnb-stone">
            for {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        </>
      ) : (
        <>
          <span className="font-bnb-display text-2xl font-bold">{kes(stay.price)}</span> <span className="text-bnb-stone">night</span>
        </>
      )}
    </p>
  );

  // "Check availability" goes to the RumiaBnB WhatsApp with the place, dates and guests already written;
  // "Request to book" (once dates are chosen) sends a request the host confirms.
  const notes = (
    <>
      {tooShort && <p className="text-sm text-red-700">The minimum stay here is {b?.min_stay_nights} nights.</p>}
      <ConciergeButton listing={ident} label="Check availability" checkIn={checkIn} checkOut={checkOut} guests={guests} className="w-full [&>button]:w-full" />
      {ready && (
        <button type="button" onClick={book} className="min-h-12 w-full rounded-xl border border-bnb-ink bg-white px-6 text-base font-semibold text-bnb-ink transition-colors hover:bg-bnb-mist">
          Request to book
        </button>
      )}
      <p className="text-center text-sm text-bnb-stone">We reply on WhatsApp. You won&rsquo;t be charged.</p>
    </>
  );

  return (
    <>
      {/* Wide screens */}
      <div ref={cardRef} className="relative hidden rounded-2xl border border-bnb-line bg-white p-6 shadow-[0_6px_24px_rgba(16,24,40,0.12)] lg:block">
        {priceLine}
        {b?.weekly_price || b?.monthly_price ? (
          <p className="mt-1 text-sm text-bnb-stone">
            Cheaper by the {b?.weekly_price ? 'week' : 'month'}: {[b?.weekly_price && `${kes(b.weekly_price)} a week`, b?.monthly_price && `${kes(b.monthly_price)} a month`].filter(Boolean).join(', ')}
          </p>
        ) : null}
        <div className="mt-5 space-y-4">
          {fields}
          {picker === 'dates' && (
            <div className="absolute right-0 top-28 z-30 w-[44rem] rounded-3xl border border-bnb-line bg-white p-6 shadow-[0_18px_50px_rgba(16,24,40,0.18)]">
              <p className="font-bnb-display text-xl font-bold text-bnb-ink">{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select dates'}</p>
              <p className="text-sm text-bnb-stone">{checkIn && checkOut ? shortRange(checkIn, checkOut) : b?.min_stay_nights && b.min_stay_nights > 1 ? `Minimum stay: ${b.min_stay_nights} nights` : 'Add your travel dates for the exact price'}</p>
              <div className="mt-3">
                <StayCalendar months={2} checkIn={checkIn} checkOut={checkOut} onChange={setDates} availableFrom={b?.available_from} availableUntil={b?.available_until} />
              </div>
              <div className="mt-2 flex justify-end gap-4">
                <button type="button" onClick={() => setDates(null, null)} className="text-sm font-semibold text-bnb-ink underline underline-offset-4">
                  Clear dates
                </button>
                <button type="button" onClick={() => setPicker(null)} className="rounded-lg bg-bnb-ink px-4 py-2 text-sm font-semibold text-white">
                  Close
                </button>
              </div>
            </div>
          )}
          {picker === 'guests' && (
            <div className="rounded-xl border border-bnb-line p-4">
              <GuestsStepper value={guests} onChange={(n) => setGuests(Math.max(1, n))} max={maxGuests} hint={`This place takes up to ${maxGuests}`} />
            </div>
          )}
          {notes}
          {ready && breakdown}
        </div>
      </div>

      {/* Phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bnb-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <button type="button" onClick={() => setSheet(true)} className="text-left">
            {total && ready ? (
              <span className="block font-semibold text-bnb-ink underline underline-offset-2">{kes(total.total)}</span>
            ) : (
              <span className="block text-bnb-ink">
                <span className="font-semibold">{kes(stay.price)}</span> night
              </span>
            )}
            <span className="block text-sm text-bnb-ink underline underline-offset-2">{checkIn && checkOut ? shortRange(checkIn, checkOut) : 'Add dates'}</span>
          </button>
          <ConciergeButton listing={ident} label="Check availability" checkIn={checkIn} checkOut={checkOut} guests={guests} className="shrink-0" />
        </div>
      </div>
      <Drawer open={sheet} onOpenChange={setSheet}>
        <DrawerContent className="max-h-[94dvh] bg-white">
          <DrawerTitle className="sr-only">Choose your dates</DrawerTitle>
          <div className="space-y-5 overflow-y-auto px-5 pb-6 pt-2">
            <div>
              <p className="font-bnb-display text-2xl font-bold text-bnb-ink">{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select dates'}</p>
              <p className="text-sm text-bnb-stone">{checkIn && checkOut ? shortRange(checkIn, checkOut) : 'Add your travel dates for the exact price'}</p>
            </div>
            <StayCalendar checkIn={checkIn} checkOut={checkOut} onChange={(a, z) => { setCheckIn(a); setCheckOut(z); }} availableFrom={b?.available_from} availableUntil={b?.available_until} />
            <GuestsStepper value={guests} onChange={(n) => setGuests(Math.max(1, n))} max={maxGuests} hint={`Up to ${maxGuests}`} />
            {ready && breakdown}
            {notes}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
