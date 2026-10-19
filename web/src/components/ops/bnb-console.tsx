'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia } from '@/lib/api/rumia';
import { extractApiErrorMessage } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { ago } from './operations';

type StayRow = components['schemas']['StayRow'];
type StayDetail = components['schemas']['StayDetail'];
type ContactRow = components['schemas']['ContactRow'];
type HostRow = components['schemas']['HostAdminRow'];
type Status = StayRow['status'];

const STATUSES: Status[] = ['requested', 'confirmed', 'disputed', 'completed', 'no_show', 'declined', 'cancelled'];
const LABEL: Record<Status, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  completed: 'Stayed',
  no_show: 'Did not stay',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const card = 'rounded-2xl border border-slate-200/60 bg-white p-4';
const btn = 'min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50';
const primary = 'min-h-10 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50';
const input = 'mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm';
const kes = (n: number | null | undefined) => (n == null ? '-' : `KSh ${Math.round(n).toLocaleString('en-KE')}`);

type Tab = 'requests' | 'contacts' | 'hosts' | 'record';

/** RumiaBnB concierge: every request and contact, host fee terms and invites, and bookings arranged on WhatsApp. */
export function BnbConsole() {
  const [tab, setTab] = useState<Tab>('requests');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const tabs: Array<[Tab, string]> = [
    ['requests', 'Requests'],
    ['contacts', 'Contacts'],
    ['hosts', 'Hosts and fees'],
    ['record', 'Record a booking'],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">RumiaBnB</h1>
        <p className="text-sm text-slate-500">Booking requests, where guests came from, and what each host owes.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tab === key ? primary : btn}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'requests' && <Requests tick={tick} onChange={refresh} />}
      {tab === 'contacts' && <Contacts tick={tick} />}
      {tab === 'hosts' && <Hosts tick={tick} onChange={refresh} />}
      {tab === 'record' && (
        <RecordBooking
          onDone={() => {
            refresh();
            setTab('requests');
          }}
        />
      )}
    </div>
  );
}

function useList<T>(load: () => Promise<{ data?: T; error?: unknown; response: Response }>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    load()
      .then(({ data, error, response }) => {
        if (!live) return;
        if (data) setState({ data, error: null });
        else
          setState({
            data: null,
            error: response.status === 403 || response.status === 401 ? 'Your account does not have RumiaBnB access (admin or market lead).' : extractApiErrorMessage(error) ?? 'Could not load this.',
          });
      })
      .catch(() => live && setState({ data: null, error: 'Could not load this. Check your connection.' }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Loading({ error }: { error: string | null }) {
  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>;
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
    </p>
  );
}

function Requests({ tick, onChange }: { tick: number; onChange: () => void }) {
  const [status, setStatus] = useState<Status | ''>('');
  const { data, error } = useList<StayRow[]>(
    () => rumia.GET('/api/v1/ops/stays', { params: { query: status ? { status } : {} } }),
    [status, tick],
  );
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <label className="text-sm text-slate-600">
        Status{' '}
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')} className="ml-2 rounded-lg border border-slate-300 px-2 py-1">
          <option value="">All (open first)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-500">No requests.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className={card}>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-start justify-between gap-2 text-left">
                <span>
                  <span className="font-semibold text-slate-900">{r.listing_title}</span>{' '}
                  <span className="text-slate-500">
                    {r.check_in} to {r.check_out} ({r.nights}n), {r.guest_name}, {r.guest_phone}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Ref {r.ref_code ?? '-'} · {r.origin === 'concierge' ? 'via concierge' : 'site request'} · source {r.source ?? 'unknown'}
                    {r.utm_campaign ? ` / ${r.utm_campaign}` : ''} · {ago(r.created_at)}
                  </span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-semibold text-slate-900">{LABEL[r.status]}</span>
                  <span className="text-slate-500">
                    {kes(r.agreed_total ?? r.quoted_total)}
                    {r.fee_amount != null ? `, fee ${kes(r.fee_amount)} (${r.fee_status})` : ''}
                  </span>
                </span>
              </button>
              {open === r.id && <RequestDetail id={r.id} onChange={onChange} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useList<StayDetail>(() => rumia.GET('/api/v1/ops/stays/{req_id}', { params: { path: { req_id: id } } }), [id, version]);
  const [to, setTo] = useState<Status>('confirmed');
  const [note, setNote] = useState('');
  const [total, setTotal] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="mt-3"><Loading error={error} /></div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await rumia.POST('/api/v1/ops/stays/{req_id}/status', {
      params: { path: { req_id: id } },
      body: { to_status: to, note, agreed_total: total ? Number(total) : null },
    });
    setBusy(false);
    if (err) return toast.error(extractApiErrorMessage(err) ?? 'Could not change the status.');
    toast.success(`Marked ${LABEL[to].toLowerCase()}.`);
    setNote('');
    setVersion((v) => v + 1);
    onChange();
  }

  return (
    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
      <div className="space-y-2 text-sm text-slate-700">
        {data.guest_note && <p>Guest: &ldquo;{data.guest_note}&rdquo;</p>}
        {data.host_note && <p>Host: &ldquo;{data.host_note}&rdquo;</p>}
        <p>
          Reports: guest {data.guest_report ?? '-'}, host {data.host_report ?? '-'}
        </p>
        <ol className="space-y-1 text-xs text-slate-500">
          {data.events.map((ev, i) => (
            <li key={i}>
              {new Date(ev.at).toLocaleString('en-KE')} · {ev.actor} · {ev.action}
              {ev.to_status ? ` → ${ev.to_status}` : ''}
              {ev.note ? ` · ${ev.note}` : ''}
            </li>
          ))}
        </ol>
      </div>
      <form onSubmit={save} className="space-y-2">
        <label className="block text-xs font-semibold text-slate-600">
          Change status to
          <select value={to} onChange={(e) => setTo(e.target.value as Status)} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Agreed room price (optional)
          <input type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className={input} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Why (kept in the history)
          <input required minLength={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Host confirmed by phone" className={input} />
        </label>
        <button type="submit" disabled={busy} className={primary}>
          Save
        </button>
      </form>
    </div>
  );
}

function Contacts({ tick }: { tick: number }) {
  const { data, error } = useList<ContactRow[]>(() => rumia.GET('/api/v1/ops/stays/contacts'), [tick]);
  if (!data) return <Loading error={error} />;
  if (data.length === 0) return <p className="text-sm text-slate-500">No RumiaBnB contacts yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 pr-4">Ref</th>
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Place</th>
            <th className="py-2 pr-4">How</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Booked</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.ref_code} className="border-t border-slate-100">
              <td className="py-2 pr-4 font-mono">{c.ref_code}</td>
              <td className="py-2 pr-4 text-slate-500">{ago(c.created_at)}</td>
              <td className="py-2 pr-4">{c.listing_title ?? 'Not chosen yet'}</td>
              <td className="py-2 pr-4">{c.channel === 'request' ? 'Request form' : c.handled_by === 'concierge' ? 'Concierge chat' : c.channel}</td>
              <td className="py-2 pr-4">
                {c.source ?? 'unknown'}
                {c.utm_campaign ? ` / ${c.utm_campaign}` : ''}
              </td>
              <td className="py-2 pr-4">{c.has_request ? 'Yes' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">To record a booking from a chat, use its reference code in Record a booking.</p>
    </div>
  );
}

function Hosts({ tick, onChange }: { tick: number; onChange: () => void }) {
  const { data, error } = useList<HostRow[]>(() => rumia.GET('/api/v1/ops/stays/hosts'), [tick]);
  const [invite, setInvite] = useState<{ org: string; url: string } | null>(null);
  if (!data) return <Loading error={error} />;
  if (data.length === 0) return <p className="text-sm text-slate-500">No hosts with short stays yet. Create the listing first.</p>;

  async function makeInvite(orgId: string) {
    const { data: res, error: err } = await rumia.POST('/api/v1/ops/stays/hosts/{org_id}/invite', { params: { path: { org_id: orgId } } });
    if (err || !res) return toast.error(extractApiErrorMessage(err) ?? 'Could not create the invite.');
    setInvite({ org: orgId, url: res.url });
    navigator.clipboard?.writeText(res.url).then(() => toast.success('Invite link copied.')).catch(() => null);
  }

  return (
    <ul className="space-y-3">
      {data.map((h) => {
        const a = h.agreement as { fee_percent?: number; fee_min?: number; fee_night_cap?: number | null; effective_from?: string } | null;
        return (
          <li key={h.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-500">
                  {h.listings.map((l) => l.title).join(', ')} · {h.has_login ? 'owner has a login' : 'managed by us, no owner login'} · {h.open_requests} open
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {a ? `Fee ${a.fee_percent}% , min KSh ${a.fee_min}, first ${a.fee_night_cap ?? 'all'} nights, since ${a.effective_from}` : 'Default terms (10%, min KSh 500, first 30 nights)'}
                </p>
              </div>
              <button type="button" onClick={() => makeInvite(h.id)} className={btn}>
                {h.has_login ? 'New invite link' : 'Invite owner to dashboard'}
              </button>
            </div>
            {invite?.org === h.id && (
              <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-700">
                {invite.url}
                <span className="mt-1 block font-sans text-slate-500">One use, 14 days. Send it only to the owner.</span>
              </p>
            )}
            <AgreementForm orgId={h.id} onDone={onChange} />
          </li>
        );
      })}
    </ul>
  );
}

function AgreementForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs font-semibold text-slate-700 underline">
        Set fee terms
      </button>
    );

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await rumia.POST('/api/v1/ops/stays/agreements', {
      body: {
        org_id: orgId,
        fee_percent: Number(f.get('percent')),
        fee_min: Number(f.get('min') || 0),
        fee_night_cap: f.get('cap') ? Number(f.get('cap')) : null,
        effective_from: String(f.get('from') || '') || null,
        note: String(f.get('note') || '') || null,
      },
    });
    setBusy(false);
    if (error) return toast.error(extractApiErrorMessage(error) ?? 'Could not save the terms.');
    toast.success('Fee terms saved.');
    setOpen(false);
    onDone();
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-5 sm:items-end">
      <label className="text-xs font-semibold text-slate-600">
        Fee %
        <input name="percent" type="number" step="0.5" min={0} max={100} required defaultValue={10} className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Minimum (KSh)
        <input name="min" type="number" min={0} defaultValue={500} className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Counted nights
        <input name="cap" type="number" min={1} defaultValue={30} className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        From
        <input name="from" type="date" className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-4">
        Note (where it was agreed)
        <input name="note" maxLength={500} className={input} />
      </label>
      <button type="submit" disabled={busy} className={primary}>
        Save terms
      </button>
    </form>
  );
}

function RecordBooking({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await rumia.POST('/api/v1/ops/stays', {
      body: {
        listing: String(f.get('listing')),
        check_in: String(f.get('check_in')),
        check_out: String(f.get('check_out')),
        guests: Number(f.get('guests')),
        guest_name: String(f.get('name')),
        guest_phone: String(f.get('phone')),
        ref_code: String(f.get('ref') || '') || null,
        note: String(f.get('note') || '') || null,
      },
    });
    setBusy(false);
    if (error) return toast.error(extractApiErrorMessage(error) ?? 'Could not record the booking.');
    toast.success('Booking recorded. The host has been notified.');
    onDone();
  }
  return (
    <form onSubmit={save} className={`${card} grid max-w-2xl gap-3 sm:grid-cols-2`}>
      <p className="text-sm text-slate-600 sm:col-span-2">
        For a stay arranged on WhatsApp. Use the chat&rsquo;s reference code so the booking keeps the post that brought the guest.
      </p>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
        Place (slug from its RumiaBnB address, e.g. regal-cottage)
        <input name="listing" required className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Check-in
        <input name="check_in" type="date" required className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Check-out
        <input name="check_out" type="date" required className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Guests
        <input name="guests" type="number" min={1} max={50} required defaultValue={2} className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Chat reference code
        <input name="ref" maxLength={8} className={`${input} uppercase`} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Guest name
        <input name="name" required minLength={2} className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Guest phone
        <input name="phone" required type="tel" className={input} />
      </label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
        Note
        <input name="note" maxLength={1000} className={input} />
      </label>
      <button type="submit" disabled={busy} className={`${primary} sm:col-span-2`}>
        Record booking
      </button>
    </form>
  );
}
