'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia } from '@/lib/api/rumia';

/** The ops endpoints return plain dicts, so each panel casts once to the shape it reads. */
interface QueueItem {
  count: number;
  oldest_hours: number | null;
}
interface Queues {
  review: QueueItem;
  reports: QueueItem;
  stale: QueueItem;
  unverified_busy: QueueItem;
}
interface ReviewRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  updated_at: string;
  org_name: string;
  standing: string | null;
  reason: string | null;
  open_reports: number;
  duplicate_photos: number;
}
interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  priority: number;
  created_at: string;
  slug: string;
  name: string;
  status: string;
  same_reason_count: number;
}
interface StaleOrg {
  id: string;
  name: string;
  standing: string | null;
  unconfirmed: number;
  total: number;
}
interface HealthArea {
  slug: string;
  name: string;
  live: number;
  fresh: number;
  searches_30d: number;
  gap: boolean;
}
interface MarketHealth {
  market: string;
  live: number;
  stale: number;
  fresh: number;
  fresh_share: number;
  areas: HealthArea[];
}

export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '-';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '-';
  const hours = Math.max(0, (now - then) / 3600000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 24) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function hoursText(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

const REASON_LABEL: Record<string, string> = {
  not_available: 'Not available',
  wrong_price: 'Wrong price',
  scam: 'Scam',
  wrong_location: 'Wrong location',
  other: 'Other',
};

type Load<T> = { state: 'loading' } | { state: 'error'; forbidden: boolean } | { state: 'ready'; data: T };

/** Loads an ops list and tells "you are not staff" (403) apart from a failure. */
function useOps<T>(path: '/api/v1/ops/queues' | '/api/v1/ops/review' | '/api/v1/ops/reports' | '/api/v1/ops/stale-orgs', tick = 0) {
  const [value, setValue] = useState<Load<T>>({ state: 'loading' });
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await rumia.GET(path).catch(() => null);
      if (!active) return;
      if (!res || !res.data) setValue({ state: 'error', forbidden: res?.response.status === 403 || res?.response.status === 401 });
      else setValue({ state: 'ready', data: res.data as unknown as T });
    })();
    return () => {
      active = false;
    };
  }, [path, tick]);
  return value;
}

function Status({ load }: { load: Load<unknown> }) {
  if (load.state === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
      </p>
    );
  }
  if (load.state === 'error') {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {load.forbidden ? 'Your account does not have access to operations yet. Ask an admin to assign you a role.' : 'Could not load this. Check your connection and refresh.'}
      </p>
    );
  }
  return null;
}

const card = 'rounded-2xl border border-slate-200/60 bg-white p-4';
const btn = 'min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50';

export function OverviewPanel({ goTo }: { goTo: (tab: 'review' | 'reports') => void }) {
  const queues = useOps<Queues>('/api/v1/ops/queues');
  const stale = useOps<StaleOrg[]>('/api/v1/ops/stale-orgs');
  if (queues.state !== 'ready') return <Status load={queues} />;
  const q = queues.data;
  const tiles: Array<[string, QueueItem, string, (() => void) | null]> = [
    ['Review', q.review, 'Places waiting for a decision', () => goTo('review')],
    ['Reports', q.reports, 'Open problems from visitors', () => goTo('reports')],
    ['Stale', q.stale, 'Not confirmed recently', null],
    ['Busy but unverified', q.unverified_busy, 'Asked about a lot, never visited', null],
  ];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, item, hint, go]) => (
          <li key={label} className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{item.count}</p>
            <p className="text-xs text-slate-500">{hint}</p>
            {item.oldest_hours != null && item.count > 0 && <p className="mt-1 text-xs text-slate-500">Oldest {hoursText(item.oldest_hours)}</p>}
            {go && item.count > 0 && (
              <button type="button" onClick={go} className="mt-2 text-xs font-semibold text-emerald-700 underline underline-offset-2">
                Open
              </button>
            )}
          </li>
        ))}
      </ul>
      <section aria-labelledby="stale-heading">
        <h2 id="stale-heading" className="mb-2 text-sm font-bold text-slate-900">
          Listers with places to confirm
        </h2>
        {stale.state !== 'ready' ? (
          <Status load={stale} />
        ) : stale.data.length === 0 ? (
          <p className="text-sm text-slate-500">Everyone is up to date.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white">
            {stale.data.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="font-semibold text-slate-900">{o.name}</span>
                <span className="text-slate-500">
                  {o.unconfirmed} of {o.total} to confirm{o.standing === 'watch' ? ' · on watch' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ReviewPanel() {
  const [tick, setTick] = useState(0);
  const rows = useOps<ReviewRow[]>('/api/v1/ops/review', tick);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const decide = useCallback(async (id: string, decision: 'approve' | 'request_changes' | 'reject', note?: string) => {
    setBusy(`${decision}:${id}`);
    const res = await rumia
      .POST('/api/v1/ops/properties/{property_id}/review', { params: { path: { property_id: id } }, body: { decision, note: note || undefined } })
      .catch(() => null);
    setBusy(null);
    if (!res || res.error) return void toast.error('Could not save that decision.');
    toast.success(decision === 'approve' ? 'Approved.' : decision === 'reject' ? 'Rejected.' : 'Changes requested.');
    setTick((n) => n + 1);
  }, []);

  const visit = useCallback(async (id: string, note?: string) => {
    setBusy(`visit:${id}`);
    const res = await rumia.POST('/api/v1/ops/properties/{property_id}/visit', { params: { path: { property_id: id } }, body: { note: note || undefined } }).catch(() => null);
    setBusy(null);
    if (!res || res.error) return void toast.error('Could not record the visit.');
    toast.success('Visit recorded. Shown as "Visited by Rumia" for 12 months.');
  }, []);

  if (rows.state !== 'ready') return <Status load={rows} />;
  if (rows.data.length === 0) return <p className="text-sm text-slate-500">Nothing is waiting for review.</p>;
  return (
    <ul className="space-y-3">
      {rows.data.map((r) => {
        const note = notes[r.id] ?? '';
        return (
          <li key={r.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/p/${r.slug}`} target="_blank" className="text-sm font-bold text-slate-900 underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {r.org_name} · {r.kind} · updated {ago(r.updated_at)}
                  {r.standing === 'watch' ? ' · lister on watch' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {r.reason && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{r.reason}</span>}
                {r.open_reports > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-800">{r.open_reports} open report(s)</span>}
                {r.duplicate_photos > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-800">photos used elsewhere</span>}
              </div>
            </div>
            <label className="mt-3 block text-xs text-slate-600">
              Note (needed to request changes or reject)
              <input value={note} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy === `approve:${r.id}`} onClick={() => void decide(r.id, 'approve', note)} className="min-h-10 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                Approve
              </button>
              <button type="button" disabled={!note.trim() || busy === `request_changes:${r.id}`} onClick={() => void decide(r.id, 'request_changes', note)} className={btn}>
                Request changes
              </button>
              <button type="button" disabled={!note.trim() || busy === `reject:${r.id}`} onClick={() => void decide(r.id, 'reject', note)} className={btn}>
                Reject
              </button>
              <button type="button" disabled={busy === `visit:${r.id}`} onClick={() => void visit(r.id, note)} className={btn}>
                Record visit
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const RESOLUTIONS: Array<[string, string]> = [
  ['dismiss', 'Dismiss'],
  ['resolved', 'Resolved'],
  ['remove_listing', 'Remove listing'],
  ['suspend_org', 'Suspend lister'],
];

export function ReportsPanel() {
  const [tick, setTick] = useState(0);
  const rows = useOps<ReportRow[]>('/api/v1/ops/reports', tick);
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, resolution: string) {
    if (resolution === 'remove_listing' || resolution === 'suspend_org') {
      if (!window.confirm(resolution === 'remove_listing' ? 'Remove this listing from the site?' : 'Suspend this lister? All their places will be hidden.')) return;
    }
    setBusy(`${resolution}:${id}`);
    const res = await rumia.POST('/api/v1/ops/reports/{report_id}/resolve', { params: { path: { report_id: id } }, body: { resolution } }).catch(() => null);
    setBusy(null);
    if (!res || res.error) return void toast.error('Could not resolve that report.');
    toast.success('Report closed.');
    setTick((n) => n + 1);
  }

  if (rows.state !== 'ready') return <Status load={rows} />;
  if (rows.data.length === 0) return <p className="text-sm text-slate-500">No open reports.</p>;
  return (
    <ul className="space-y-3">
      {rows.data.map((r) => (
        <li key={r.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href={`/p/${r.slug}`} target="_blank" className="text-sm font-bold text-slate-900 underline-offset-2 hover:underline">
                {r.name}
              </Link>
              <p className="text-xs text-slate-500">
                {ago(r.created_at)} · place is {r.status}
                {r.same_reason_count > 1 ? ` · ${r.same_reason_count} people reported this` : ''}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.reason === 'scam' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{REASON_LABEL[r.reason] ?? r.reason}</span>
          </div>
          {r.details && <p className="mt-2 text-sm text-slate-700">{r.details}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {RESOLUTIONS.map(([value, label]) => (
              <button key={value} type="button" disabled={busy === `${value}:${r.id}`} onClick={() => void resolve(r.id, value)} className={btn}>
                {label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HealthPanel() {
  const [health, setHealth] = useState<Load<MarketHealth>>({ state: 'loading' });
  useEffect(() => {
    let active = true;
    (async () => {
      const markets = await rumia.GET('/api/v1/markets').catch(() => null);
      const list = (markets?.data as unknown as Array<{ slug: string }> | undefined) ?? [];
      if (!list[0]) return void (active && setHealth({ state: 'error', forbidden: false }));
      const res = await rumia.GET('/api/v1/ops/markets/{market_slug}/health', { params: { path: { market_slug: list[0].slug } } }).catch(() => null);
      if (!active) return;
      if (!res?.data) setHealth({ state: 'error', forbidden: res?.response.status === 403 });
      else setHealth({ state: 'ready', data: res.data as unknown as MarketHealth });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (health.state !== 'ready') return <Status load={health} />;
  const h = health.data;
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ['Live', h.live],
            ['Fresh (14 days)', h.fresh],
            ['Stale', h.stale],
            ['Fresh share', `${Math.round(h.fresh_share * 100)}%`],
          ] as const
        ).map(([label, value]) => (
          <li key={label} className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Supply against searches per area</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2">Area</th>
              <th scope="col" className="px-4 py-2">Live</th>
              <th scope="col" className="px-4 py-2">Fresh</th>
              <th scope="col" className="px-4 py-2">Searches (30 d)</th>
              <th scope="col" className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {h.areas.map((a) => (
              <tr key={a.slug}>
                <th scope="row" className="px-4 py-2 font-semibold text-slate-900">{a.name}</th>
                <td className="px-4 py-2">{a.live}</td>
                <td className="px-4 py-2">{a.fresh}</td>
                <td className="px-4 py-2">{a.searches_30d}</td>
                <td className="px-4 py-2">{a.gap && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Demand, little fresh supply</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TABS = [
  ['overview', 'Overview'],
  ['review', 'Review'],
  ['reports', 'Reports'],
  ['health', 'Market health'],
] as const;

export function Operations() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('overview');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">Operations</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">What needs a decision: new places, problems visitors reported, and where supply is thin.</p>
      </div>
      <div role="tablist" aria-label="Operations sections" className="flex gap-2 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === id ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'overview' && <OverviewPanel goTo={setTab} />}
        {tab === 'review' && <ReviewPanel />}
        {tab === 'reports' && <ReportsPanel />}
        {tab === 'health' && <HealthPanel />}
      </div>
    </div>
  );
}
