'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { staysApi, type GuestStayView } from '@/lib/site/bnb-api';
import { kes } from '@/lib/site/stay-format';
import { ConciergeButton } from './concierge-button';
import { cn } from '@/lib/utils/cn';

const HEADLINE: Record<GuestStayView['status'], string> = {
  requested: 'Request sent. Waiting for the host.',
  confirmed: 'Confirmed. See you there.',
  declined: 'The host could not take this request.',
  cancelled: 'This request was cancelled.',
  completed: 'Thanks for staying.',
  no_show: 'Marked as not stayed.',
  disputed: 'We are checking what happened.',
};

const NEXT: Partial<Record<GuestStayView['status'], string>> = {
  requested: 'Hosts usually answer within a day. We will follow up if they do not. Keep this page: it is your link to the request.',
  confirmed: 'The host will contact you on WhatsApp about payment and arrival. Pay the host directly as agreed.',
  declined: 'Ask us on WhatsApp and we will suggest another place for the same dates.',
  disputed: 'Our team will contact you and the host.',
};

function dateRange(a: string, b: string): string {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${f(a)} to ${f(b)}`;
}

/** Where the request is, in three steps, with the actions the guest can take at this point. */
export function RequestStatus({ token }: { token: string }) {
  const justSent = useSearchParams().get('sent') === '1';
  const [view, setView] = useState<GuestStayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    staysApi.status(token).then(setView).catch((e) => setError(e instanceof Error ? e.message : 'Could not load this request.'));
  }, [token]);
  useEffect(load, [load]);

  async function act(fn: () => Promise<GuestStayView>) {
    setBusy(true);
    setError(null);
    try {
      setView(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !view) {
    return (
      <div>
        <h1 className="font-bnb-display text-3xl font-bold text-bnb-ink">We could not find this request</h1>
        <p className="mt-3 text-bnb-stone">The link may be incomplete, or a newer link was sent for the same dates.</p>
        <ConciergeButton className="mt-6" label="Ask us on WhatsApp" />
      </div>
    );
  }
  if (!view) return <p className="text-bnb-stone">Loading your request…</p>;

  const reached = { requested: 1, confirmed: 2, completed: 3 }[view.status as 'requested'] ?? 0;
  const steps = ['Requested', 'Confirmed by the host', 'Stayed'];

  return (
    <div>
      {justSent && view.status === 'requested' && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-bnb-forest px-3 py-1 text-sm font-semibold text-bnb-mist">
          <Check className="h-4 w-4" aria-hidden /> Sent
        </p>
      )}
      <h1 className="font-bnb-display text-3xl font-bold leading-tight tracking-tight text-bnb-ink">{HEADLINE[view.status]}</h1>
      <p className="mt-3 text-lg text-bnb-ink">
        {view.listing_slug ? (
          <Link href={`/stay/${view.listing_slug}`} className="font-semibold underline-offset-4 hover:underline">
            {view.listing_title}
          </Link>
        ) : (
          <span className="font-semibold">{view.listing_title}</span>
        )}
        , {dateRange(view.check_in, view.check_out)}, {view.guests} {view.guests === 1 ? 'guest' : 'guests'}
      </p>
      <p className="mt-1 text-bnb-stone">
        {kes(view.agreed_total ?? view.quoted_total)} for {view.nights} {view.nights === 1 ? 'night' : 'nights'}
        {view.agreed_total != null && view.agreed_total !== view.quoted_total ? ' (as agreed with the host)' : ''}
        {view.ref_code ? `. Reference ${view.ref_code}` : ''}
      </p>

      {reached > 0 && (
        <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Progress">
          {steps.map((label, i) => (
            <li key={label} className={cn('border-t-4 pt-2 text-sm', i < reached ? 'border-bnb-forest text-bnb-ink' : 'border-bnb-line text-bnb-stone')}>
              <span className="sr-only">{i < reached ? 'Done: ' : 'Next: '}</span>
              {label}
            </li>
          ))}
        </ol>
      )}

      {view.host_note && (
        <blockquote className="mt-6 rounded-xl bg-white p-4 ring-1 ring-bnb-line">
          <p className="text-sm text-bnb-stone">From the host</p>
          <p className="mt-1 text-bnb-ink">{view.host_note}</p>
        </blockquote>
      )}

      {NEXT[view.status] && <p className="mt-6 max-w-prose text-bnb-ink/90">{NEXT[view.status]}</p>}

      {view.can_report && !view.guest_report && (
        <div className="mt-8 rounded-[1.25rem] bg-white p-5 ring-1 ring-bnb-line">
          <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">Did you stay?</h2>
          <p className="mt-1 text-sm text-bnb-stone">This helps us keep listings honest.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => act(() => staysApi.report(token, true))} className="min-h-11 rounded-full bg-bnb-forest px-5 font-semibold text-bnb-mist hover:bg-bnb-pine disabled:opacity-60">
              Yes, I stayed
            </button>
            <button type="button" disabled={busy} onClick={() => act(() => staysApi.report(token, false))} className="min-h-11 rounded-full border border-bnb-line bg-white px-5 font-semibold text-bnb-ink hover:border-bnb-stone disabled:opacity-60">
              No, I did not
            </button>
          </div>
        </div>
      )}
      {view.guest_report && view.status !== 'disputed' && (
        <p className="mt-6 text-sm text-bnb-stone">You told us you {view.guest_report === 'stayed' ? 'stayed' : 'did not stay'}. Thank you.</p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-bnb-line pt-6">
        <ConciergeButton label="Message us on WhatsApp" variant="outline" />
        {view.can_cancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Cancel this request?')) void act(() => staysApi.cancel(token));
            }}
            className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline disabled:opacity-60"
          >
            Cancel request
          </button>
        )}
      </div>
    </div>
  );
}
