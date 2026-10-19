'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Phone, MessageCircle } from 'lucide-react';
import { rumia } from '@/lib/api/rumia';
import { extractApiErrorMessage } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { kes } from '@/lib/site/stay-format';
import { buildWhatsAppUrl } from '@/lib/utils/phone';
import { ConciergeButton } from './concierge-button';
import { cn } from '@/lib/utils/cn';

type HostOrg = components['schemas']['HostOrg'];
type StayRow = components['schemas']['StayRow'];
type Summary = components['schemas']['HostSummary'];

const RUMIA_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rumia.co.ke').replace(/\/+$/, '');

function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dates(r: StayRow): string {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return `${f(r.check_in)} to ${f(r.check_out)}, ${r.nights} ${r.nights === 1 ? 'night' : 'nights'}`;
}

const STATUS: Record<StayRow['status'], string> = {
  requested: 'Waiting for you',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Stayed',
  no_show: 'Did not stay',
  disputed: 'Being checked by RumiaBnB',
};

/** The host's RumiaBnB: what we brought them, requests to answer, stays to confirm. */
export function HostDashboard() {
  const [orgs, setOrgs] = useState<HostOrg[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<StayRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rumia.GET('/api/v1/me/host-orgs').then(({ data, error: e }) => {
      if (e || !data) return setError(extractApiErrorMessage(e) ?? 'Could not load your places.');
      setOrgs(data);
      if (data[0]) setOrgId(data[0].id);
    });
  }, []);

  // Bumped after every action so the lists and the summary reload.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!orgId) return;
    let live = true;
    const path = { params: { path: { org_id: orgId } } };
    Promise.all([rumia.GET('/api/v1/orgs/{org_id}/stays', path), rumia.GET('/api/v1/orgs/{org_id}/stays/summary', path)]).then(([r, s]) => {
      if (!live) return;
      if (r.data) setRows(r.data);
      if (s.data) setSummary(s.data);
      if (r.error || s.error) setError(extractApiErrorMessage(r.error ?? s.error) ?? 'Could not load your requests.');
    });
    return () => {
      live = false;
    };
  }, [orgId, version]);

  const today = todayIso();
  const groups = useMemo(
    () => [
      { title: 'Needs your answer', items: rows.filter((r) => r.status === 'requested') },
      { title: 'Did the guest stay?', items: rows.filter((r) => r.status === 'confirmed' && r.check_in <= today && !r.host_report) },
      { title: 'Upcoming', items: rows.filter((r) => r.status === 'confirmed' && r.check_in > today) },
      { title: 'Past', items: rows.filter((r) => !['requested', 'confirmed'].includes(r.status) || (r.status === 'confirmed' && r.check_in <= today && !!r.host_report)) },
    ],
    [rows, today],
  );

  async function signOut() {
    await fetch('/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign('/');
  }

  if (error && !orgs) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>;
  if (!orgs) return <p className="text-bnb-stone">Loading your dashboard…</p>;

  if (orgs.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink">Your account is not linked to a place yet</h1>
        <p className="mt-3 text-bnb-stone">
          If we have onboarded your place, ask us for your invite link and open it while signed in. If not, tell us about your place and we will arrange a visit.
        </p>
        <ConciergeButton className="mt-6" label="Message us on WhatsApp" />
        <button type="button" onClick={signOut} className="mt-6 block text-sm font-semibold text-bnb-stone underline-offset-4 hover:underline">
          Sign out
        </button>
      </div>
    );
  }

  const org = orgs.find((o) => o.id === orgId) ?? orgs[0];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink">{org.name}</h1>
          {orgs.length > 1 && (
            <label className="mt-2 block text-sm text-bnb-stone">
              Host
              <select value={org.id} onChange={(e) => setOrgId(e.target.value)} className="ml-2 rounded-lg border border-bnb-line bg-white px-2 py-1 text-bnb-ink">
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button type="button" onClick={signOut} className="text-sm font-semibold text-bnb-stone underline-offset-4 hover:underline">
          Sign out
        </button>
      </div>

      {summary && (
        <section aria-labelledby="results" className="mt-8">
          <h2 id="results" className="font-bnb-display text-xl font-bold text-bnb-ink">
            What RumiaBnB brought you, last 90 days
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] bg-bnb-line ring-1 ring-bnb-line sm:grid-cols-4">
            {[
              ['Views of your places', summary.views.toLocaleString('en-KE')],
              ['Enquiries', summary.contacts.toLocaleString('en-KE')],
              ['Stays completed', summary.completed.toLocaleString('en-KE')],
              ['Earned from those stays', kes(summary.room_value_completed)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <dt className="text-sm text-bnb-stone">{label}</dt>
                <dd className="mt-1 font-bnb-display text-2xl font-bold text-bnb-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-bnb-stone">
            RumiaBnB fees: {kes(summary.fees_pending)} due, {kes(summary.fees_paid)} paid.
            {summary.by_source.length > 0 &&
              ` Enquiries came from ${summary.by_source
                .map((s) => `${s.source === 'unknown' ? 'other' : s.source} (${s.contacts})`)
                .join(', ')}.`}
          </p>
        </section>
      )}

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.title} className="mt-10" aria-label={g.title}>
              <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">
                {g.title} <span className="text-bnb-stone">({g.items.length})</span>
              </h2>
              <ul className="mt-4 grid gap-4 lg:grid-cols-2">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <RequestCard row={r} orgId={org.id} today={today} onChange={reload} />
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
      {rows.length === 0 && <p className="mt-10 text-bnb-stone">No booking requests yet. New ones appear here and on your phone if notifications are on.</p>}

      <section className="mt-12 border-t border-bnb-line pt-8" aria-labelledby="places">
        <h2 id="places" className="font-bnb-display text-xl font-bold text-bnb-ink">
          Your places
        </h2>
        <ul className="mt-3 space-y-2">
          {org.listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 text-bnb-ink">
              {l.slug && l.is_active ? (
                <Link href={`/stay/${l.slug}`} className="font-semibold underline-offset-4 hover:underline">
                  {l.title}
                </Link>
              ) : (
                <span className="font-semibold">{l.title}</span>
              )}
              {!l.is_active && <span className="text-sm text-bnb-stone">Hidden from guests</span>}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose text-sm text-bnb-stone">
          To change prices, photos or dates, message us, or edit it yourself on the{' '}
          <a href={`${RUMIA_ORIGIN}/dashboard/bnb`} className="font-semibold text-bnb-forest underline-offset-4 hover:underline">
            Rumia listing editor
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function RequestCard({ row: r, orgId, today, onChange }: { row: StayRow; orgId: string; today: string; onChange: () => void }) {
  const [open, setOpen] = useState<'confirm' | 'decline' | null>(null);
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = { params: { path: { org_id: orgId, req_id: r.id } } };

  async function run(p: Promise<{ error?: unknown }>) {
    setBusy(true);
    setError(null);
    const { error: e } = await p;
    setBusy(false);
    if (e) return setError(extractApiErrorMessage(e) ?? 'That did not work. Try again.');
    setOpen(null);
    onChange();
  }

  const started = r.check_in <= today;
  const btn = 'min-h-10 rounded-full px-4 text-sm font-semibold disabled:opacity-60';
  return (
    <article className="rounded-[1.25rem] bg-white p-4 ring-1 ring-bnb-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-bnb-ink">
            {r.guest_name}, {r.guests} {r.guests === 1 ? 'guest' : 'guests'}
          </h3>
          <p className="text-sm text-bnb-stone">
            {r.listing_title}: {dates(r)}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', r.status === 'requested' ? 'bg-bnb-amber/30 text-bnb-ink' : 'bg-bnb-line text-bnb-ink')}>
          {STATUS[r.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-bnb-ink">
        {kes(r.agreed_total ?? r.quoted_total)} for the room{r.cleaning_fee ? ` + ${kes(r.cleaning_fee)} cleaning` : ''}
        {r.ref_code ? `. Ref ${r.ref_code}` : ''}
        {r.source ? `. Found you on ${r.source}` : ''}
      </p>
      {r.guest_note && <p className="mt-2 rounded-lg bg-bnb-mist p-2 text-sm text-bnb-ink">&ldquo;{r.guest_note}&rdquo;</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a href={`tel:${r.guest_phone}`} className="inline-flex items-center gap-1.5 font-semibold text-bnb-forest">
          <Phone className="h-4 w-4" aria-hidden /> {r.guest_phone}
        </a>
        <a
          href={buildWhatsAppUrl(r.guest_phone, `Hi ${r.guest_name}, this is about your RumiaBnB request for ${r.listing_title} (Ref ${r.ref_code ?? ''}).`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-bnb-forest"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
        </a>
      </div>

      {r.fee_amount != null && r.fee_status !== 'void' && (
        <p className="mt-2 text-sm text-bnb-stone">RumiaBnB fee for this stay: {kes(r.fee_amount)} ({r.fee_status}).</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {r.status === 'requested' && (
          <>
            <button type="button" disabled={busy} onClick={() => setOpen(open === 'confirm' ? null : 'confirm')} className={cn(btn, 'bg-bnb-forest text-bnb-mist hover:bg-bnb-pine')}>
              Confirm
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(open === 'decline' ? null : 'decline')} className={cn(btn, 'border border-bnb-line text-bnb-ink hover:border-bnb-stone')}>
              Decline
            </button>
          </>
        )}
        {r.status === 'confirmed' && started && !r.host_report && (
          <>
            <button type="button" disabled={busy} onClick={() => run(rumia.POST('/api/v1/orgs/{org_id}/stays/{req_id}/report', { ...path, body: { stayed: true } }))} className={cn(btn, 'bg-bnb-forest text-bnb-mist hover:bg-bnb-pine')}>
              Yes, they stayed
            </button>
            <button type="button" disabled={busy} onClick={() => run(rumia.POST('/api/v1/orgs/{org_id}/stays/{req_id}/report', { ...path, body: { stayed: false } }))} className={cn(btn, 'border border-bnb-line text-bnb-ink hover:border-bnb-stone')}>
              No, they did not
            </button>
          </>
        )}
        {r.status === 'confirmed' && !started && (
          <button type="button" disabled={busy} onClick={() => setOpen(open === 'decline' ? null : 'decline')} className={cn(btn, 'border border-bnb-line text-bnb-ink hover:border-bnb-stone')}>
            Cancel stay
          </button>
        )}
      </div>

      {open === 'confirm' && (
        <form
          className="mt-3 space-y-2 rounded-xl bg-bnb-mist p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              rumia.POST('/api/v1/orgs/{org_id}/stays/{req_id}/confirm', {
                ...path,
                body: { agreed_total: total ? Number(total) : null, host_note: note || null },
              }),
            );
          }}
        >
          <label className="block text-sm text-bnb-stone">
            Room price agreed, if not {kes(r.quoted_total)}
            <input type="number" min={0} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-bnb-line bg-white px-2 text-bnb-ink" />
          </label>
          <label className="block text-sm text-bnb-stone">
            Message to the guest (optional)
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Directions, payment details…" className="mt-1 h-10 w-full rounded-lg border border-bnb-line bg-white px-2 text-bnb-ink" />
          </label>
          <button type="submit" disabled={busy} className={cn(btn, 'bg-bnb-forest text-bnb-mist')}>
            Confirm the stay
          </button>
        </form>
      )}
      {open === 'decline' && (
        <form
          className="mt-3 space-y-2 rounded-xl bg-bnb-mist p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const body = { reason: note || null };
            void run(
              r.status === 'requested'
                ? rumia.POST('/api/v1/orgs/{org_id}/stays/{req_id}/decline', { ...path, body })
                : rumia.POST('/api/v1/orgs/{org_id}/stays/{req_id}/cancel', { ...path, body }),
            );
          }}
        >
          <label className="block text-sm text-bnb-stone">
            Reason the guest will see (optional)
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Already booked for those dates" className="mt-1 h-10 w-full rounded-lg border border-bnb-line bg-white px-2 text-bnb-ink" />
          </label>
          <button type="submit" disabled={busy} className={cn(btn, 'border border-red-300 bg-white text-red-800')}>
            {r.status === 'requested' ? 'Decline the request' : 'Cancel the stay'}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    </article>
  );
}
