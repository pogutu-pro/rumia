'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staysApi, StayApiError, type StayQuote } from '@/lib/site/bnb-api';
import { attributionFor } from '@/lib/site/attribution';
import { sessionId } from '@/lib/events';
import { kes } from '@/lib/site/stay-format';
import { rememberRequest } from '@/lib/site/my-requests';

const HEARD = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Google', 'A friend', 'WhatsApp', 'Other'];

const FIELD =
  'mt-1 h-12 w-full rounded-xl border border-bnb-line bg-white px-3 text-base text-bnb-ink focus:border-bnb-forest focus:outline-none focus:ring-2 focus:ring-bnb-forest/20';
const LABEL = 'block text-sm font-medium text-bnb-stone';

function isoToday(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const BASIS: Record<string, string> = { night: 'nightly rate', week: 'weekly rate', month: 'monthly rate' };

/** Dates, guests and contact details; shows the price for the dates before anything is sent. */
export function RequestForm({
  listing,
  title,
  nightly,
  maxGuests,
  minNights,
}: {
  listing: string;
  title: string;
  nightly: number;
  maxGuests?: number | null;
  minNights?: number | null;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  // The answer for one set of dates; ignored once the dates change, so a stale price is never shown.
  const [priced, setPriced] = useState<{ key: string; quote: StayQuote | null; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const guestOptions = useMemo(() => Array.from({ length: Math.max(1, Math.min(maxGuests || 10, 20)) }, (_, i) => i + 1), [maxGuests]);

  const key = checkIn && checkOut && checkOut > checkIn ? `${checkIn}|${checkOut}|${guests}` : '';
  const quote = priced && priced.key === key ? priced.quote : null;
  const quoteError = priced && priced.key === key ? priced.error : null;

  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      staysApi
        .quote(listing, checkIn, checkOut, guests)
        .then((q) => live && setPriced({ key, quote: q, error: null }))
        .catch((e) => live && setPriced({ key, quote: null, error: e instanceof StayApiError ? e.message : null }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [listing, key, checkIn, checkOut, guests]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    try {
      const res = await staysApi.request({
        listing,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        guest_name: String(form.get('name') ?? ''),
        guest_phone: String(form.get('phone') ?? ''),
        guest_email: String(form.get('email') ?? '') || null,
        note: String(form.get('note') ?? '') || null,
        session_id: sessionId(),
        attribution: attributionFor(String(form.get('heard') ?? '') || null),
      });
      rememberRequest({ token: res.token, title, checkIn, checkOut });
      router.push(`/r/${encodeURIComponent(res.token)}?sent=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request. Try again.');
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="request-help">
      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          Check-in
          <input type="date" required min={isoToday()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={FIELD} />
        </label>
        <label className={LABEL}>
          Check-out
          <input type="date" required min={checkIn || isoToday(1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className={LABEL}>
        Guests
        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className={FIELD}>
          {guestOptions.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'guest' : 'guests'}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl bg-bnb-mist p-4 text-sm" aria-live="polite">
        {quote ? (
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-bnb-stone">
                {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}
                {quote.rate_basis !== 'night' && `, ${BASIS[quote.rate_basis]}`}
              </dt>
              <dd className="font-medium text-bnb-ink">{kes(quote.room_total)}</dd>
            </div>
            {quote.cleaning_fee ? (
              <div className="flex justify-between gap-4">
                <dt className="text-bnb-stone">Cleaning fee</dt>
                <dd className="font-medium text-bnb-ink">{kes(quote.cleaning_fee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-bnb-line pt-1.5">
              <dt className="font-semibold text-bnb-ink">Total to pay the host</dt>
              <dd className="font-bnb-display text-lg font-bold text-bnb-ink">{kes(quote.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-bnb-stone">
            {quoteError ??
              `${kes(nightly)} a night${minNights && minNights > 1 ? `, at least ${minNights} nights` : ''}. Pick your dates to see the total.`}
          </p>
        )}
      </div>

      <label className={LABEL}>
        Your name
        <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={FIELD} />
      </label>
      <label className={LABEL}>
        Phone (WhatsApp)
        <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" className={FIELD} />
      </label>
      <label className={LABEL}>
        Email <span className="font-normal">(optional)</span>
        <input name="email" type="email" autoComplete="email" maxLength={120} className={FIELD} />
      </label>
      <label className={LABEL}>
        Anything the host should know? <span className="font-normal">(optional)</span>
        <textarea name="note" rows={3} maxLength={1000} className={`${FIELD} h-auto py-2`} />
      </label>
      <label className={LABEL}>
        How did you hear about us?
        <select name="heard" defaultValue="" className={FIELD}>
          <option value="">Choose one</option>
          {HEARD.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !quote}
        className="min-h-12 w-full rounded-full bg-bnb-amber px-6 font-semibold text-bnb-ink transition-colors hover:bg-bnb-amber-deep hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-forest disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? 'Sending request…' : 'Request these dates'}
      </button>
      <p id="request-help" className="text-xs leading-relaxed text-bnb-stone">
        Nothing is charged now. We share your name and phone with the host so they can confirm; you can follow the
        request on the next page.
      </p>
    </form>
  );
}
