'use client';

import { useEffect, useState } from 'react';
import { Photo } from './photo';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { staysApi, StayApiError, type BnbStay, type StayQuote } from '@/lib/site/bnb-api';
import { attributionFor } from '@/lib/site/attribution';
import { sessionId } from '@/lib/events';
import { kes, stayCover, stayKind, stayPath, stayPlace } from '@/lib/site/stay-format';
import { parseSearch, searchQuery, shortRange } from '@/lib/site/stay-search';
import { rememberRequest } from '@/lib/site/my-requests';

const HEARD = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Google', 'A friend', 'WhatsApp', 'Other'];
const FIELD =
  'mt-1.5 h-12 w-full rounded-xl border border-bnb-stone/40 bg-white px-3.5 text-base text-bnb-ink placeholder:text-bnb-stone/70 focus:border-bnb-ink focus:outline-none focus:ring-1 focus:ring-bnb-ink';
const LABEL = 'block text-sm font-semibold text-bnb-ink';
const BASIS = { night: 'nightly rate', week: 'weekly rate', month: 'monthly rate' } as const;

/**
 * Airbnb's "Request to book" page, minus the payment: the trip, the guest's details, and the price confirmed by the
 * API. Sending creates the request (with the campaign that brought the guest) and opens its status page.
 */
export function BookRequest({ stay, ident }: { stay: BnbStay; ident: string }) {
  const router = useRouter();
  const s = parseSearch(useSearchParams());
  const guests = Math.max(1, s.guests || 1);
  const [quote, setQuote] = useState<{ q: StayQuote | null; error: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = `${stayPath(stay)}${searchQuery({ checkIn: s.checkIn, checkOut: s.checkOut, guests })}`;

  useEffect(() => {
    if (!s.checkIn || !s.checkOut) return;
    let live = true;
    staysApi
      .quote(ident, s.checkIn, s.checkOut, guests)
      .then((q) => live && setQuote({ q, error: null }))
      .catch((e) => live && setQuote({ q: null, error: e instanceof StayApiError ? e.message : 'Could not price these dates.' }));
    return () => {
      live = false;
    };
  }, [ident, s.checkIn, s.checkOut, guests]);

  if (!s.checkIn || !s.checkOut) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="font-bnb-display text-2xl font-bold text-bnb-ink">Choose your dates first</h1>
        <Link href={stayPath(stay)} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-bnb-forest px-6 font-semibold text-white">
          Back to {stay.title}
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    try {
      const res = await staysApi.request({
        listing: ident,
        check_in: s.checkIn!,
        check_out: s.checkOut!,
        guests,
        guest_name: String(f.get('name') ?? ''),
        guest_phone: String(f.get('phone') ?? ''),
        guest_email: String(f.get('email') ?? '') || null,
        note: String(f.get('note') ?? '') || null,
        session_id: sessionId(),
        attribution: attributionFor(String(f.get('heard') ?? '') || null),
      });
      rememberRequest({ token: res.token, title: stay.title, checkIn: s.checkIn!, checkOut: s.checkOut! });
      router.push(`/r/${encodeURIComponent(res.token)}?sent=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request. Try again.');
      setSending(false);
    }
  }

  const q = quote?.q;
  const cover = stayCover(stay);

  return (
    <>
      <div className="mb-8 flex items-center gap-3">
        <Link href={back} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white" aria-label="Back to the stay">
          <ChevronLeft className="h-5 w-5 text-bnb-ink" />
        </Link>
        <h1 className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink md:text-3xl">Request to book</h1>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:gap-20">
        <form id="book-form" onSubmit={submit} className="order-2 min-w-0 pb-24 lg:order-1 lg:pb-0">
          <section className="border-b border-bnb-line pb-8">
            <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">Your trip</h2>
            <dl className="mt-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <dt className="font-semibold text-bnb-ink">Dates</dt>
                  <dd className="text-bnb-stone">{shortRange(s.checkIn, s.checkOut)}</dd>
                </div>
                <Link href={back} className="-my-2 inline-flex min-h-11 items-center px-1 font-semibold text-bnb-ink underline underline-offset-4">
                  Edit
                </Link>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <dt className="font-semibold text-bnb-ink">Guests</dt>
                  <dd className="text-bnb-stone">
                    {guests} guest{guests === 1 ? '' : 's'}
                  </dd>
                </div>
                <Link href={back} className="-my-2 inline-flex min-h-11 items-center px-1 font-semibold text-bnb-ink underline underline-offset-4">
                  Edit
                </Link>
              </div>
            </dl>
          </section>

          <section className="space-y-5 border-b border-bnb-line py-8">
            <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">Your details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={LABEL}>
                Full name
                <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={FIELD} />
              </label>
              <label className={LABEL}>
                Phone (WhatsApp)
                <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" className={FIELD} />
              </label>
            </div>
            <label className={LABEL}>
              Email <span className="font-normal text-bnb-stone">(optional)</span>
              <input name="email" type="email" autoComplete="email" maxLength={120} className={FIELD} />
            </label>
            <label className={LABEL}>
              Message to the host <span className="font-normal text-bnb-stone">(optional)</span>
              <textarea name="note" rows={4} maxLength={1000} placeholder="Who's coming, what brings you to the area, when you expect to arrive" className={`${FIELD} h-auto py-3`} />
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
          </section>

          <section className="py-8">
            <p className="flex gap-3 text-sm leading-relaxed text-bnb-stone">
              <ShieldCheck className="h-5 w-5 shrink-0 text-bnb-forest" aria-hidden />
              Nothing is charged now. The host confirms your dates, then you pay them directly as agreed. We share your name
              and phone with the host so they can reach you.
            </p>
            {(error || quote?.error) && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {error ?? quote?.error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !q}
              className="mt-6 hidden min-h-14 rounded-xl bg-bnb-forest px-8 text-lg font-semibold text-white transition-colors hover:bg-bnb-pine disabled:cursor-not-allowed disabled:opacity-60 lg:inline-block"
            >
              {sending ? 'Sending request…' : 'Request to book'}
            </button>
          </section>
        </form>

        <aside className="order-1 lg:order-2">
          <div className="rounded-2xl border border-bnb-line bg-white p-6 lg:sticky lg:top-28">
            <div className="flex gap-4 border-b border-bnb-line pb-6">
              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-bnb-line">
                {cover && <Photo src={cover} size="thumb" alt="" sizes="112px" className="object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-bnb-stone">{stayKind(stay) ?? 'Stay'}</p>
                <p className="font-semibold text-bnb-ink">{stay.title}</p>
                <p className="text-sm text-bnb-stone">{stayPlace(stay)}</p>
              </div>
            </div>
            <h2 className="mt-6 font-bnb-display text-lg font-bold text-bnb-ink">Price details</h2>
            {q ? (
              <dl className="mt-4 space-y-3 text-bnb-ink">
                <div className="flex justify-between gap-4">
                  <dt>
                    {kes(Math.round(q.room_total / q.nights))} × {q.nights} {q.nights === 1 ? 'night' : 'nights'}
                    {q.rate_basis !== 'night' && <span className="block text-sm text-bnb-stone">{BASIS[q.rate_basis]}</span>}
                  </dt>
                  <dd>{kes(q.room_total)}</dd>
                </div>
                {q.cleaning_fee ? (
                  <div className="flex justify-between gap-4">
                    <dt>Cleaning fee</dt>
                    <dd>{kes(q.cleaning_fee)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-bnb-line pt-4 font-semibold">
                  <dt>Total (KES)</dt>
                  <dd>{kes(q.total)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-bnb-stone">{quote?.error ?? 'Checking the price for your dates…'}</p>
            )}
          </div>
        </aside>
      </div>

      {/* Phones: the total and the button stay in reach while filling the form. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bnb-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="text-bnb-ink">
            <span className="block font-semibold">{q ? kes(q.total) : '…'}</span>
            <span className="block text-sm text-bnb-stone">
              {shortRange(s.checkIn, s.checkOut)}, {guests} guest{guests === 1 ? '' : 's'}
            </span>
          </p>
          <button type="submit" form="book-form" disabled={sending || !q} className="min-h-12 rounded-xl bg-bnb-forest px-6 font-semibold text-white hover:bg-bnb-pine disabled:opacity-60">
            {sending ? 'Sending…' : 'Request to book'}
          </button>
        </div>
      </div>
    </>
  );
}
