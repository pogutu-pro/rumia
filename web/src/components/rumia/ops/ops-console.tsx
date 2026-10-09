'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { rumia } from '@/lib/api/rumia';

/** Everything below is untyped on the wire (the API returns plain dicts), so each panel casts once. */

export interface QueueItem {
  count: number;
  oldest_hours: number | null;
}

export interface Queues {
  review: QueueItem;
  reports: QueueItem;
  stale: QueueItem;
  unverified_busy: QueueItem;
}

export interface ReviewRow {
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

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  priority: number;
  created_at: string;
  property_id: string;
  slug: string;
  name: string;
  status: string;
  same_reason_count: number;
}

export interface StaleOrg {
  id: string;
  name: string;
  standing: string | null;
  unconfirmed: number;
  total: number;
  oldest_confirmation: string | null;
}

export interface HealthArea {
  slug: string;
  name: string;
  live: number;
  fresh: number;
  searches_30d: number;
  gap: boolean;
}

export interface MarketHealth {
  market: string;
  live: number;
  stale: number;
  fresh: number;
  fresh_share: number;
  areas: HealthArea[];
}

export interface MarketOption {
  slug: string;
  name: string;
  status: string;
}

export function timeAgo(iso: string | null | undefined, unit = 'h'): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const hours = Math.max(0, (Date.now() - then) / 3600000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 24) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function oldestLabel(item: QueueItem): string {
  if (item.oldest_hours === null || item.oldest_hours === undefined) return '—';
  return `oldest ${timeAgo(new Date(Date.now() - item.oldest_hours * 3600000).toISOString())}`;
}

/** Pull a human message out of the API's error body (string detail or validation list). */
function apiError(err: unknown, fallback: string): string {
  const detail = (err as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && 'msg' in detail[0]) {
    return String((detail[0] as { msg: string }).msg);
  }
  return fallback;
}

export function OpsNav() {
  const pathname = usePathname();
  const tabs: Array<[string, string, string]> = [
    ['/ops/queues', 'Queues', 'Queues'],
    ['/ops/review', 'Review', 'Review'],
    ['/ops/reports', 'Reports', 'Reports'],
    ['/ops/health', 'Market health', 'Market health'],
  ];
  return (
    <nav aria-label="Ops sections" className="flex flex-wrap gap-2">
      {tabs.map(([href, label, key]) => {
        const active = pathname === href || (key === 'Queues' && pathname === '/ops');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-rum-control border px-4 text-sm font-semibold ${
              active
                ? 'border-rum-accent bg-rum-accent text-rum-on-accent'
                : 'border-rum-line bg-rum-raised text-rum-text'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Shared loading / empty / error shapes for the ops panels. */
export function PanelState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-danger">{error}</p>
    );
  }
  if (empty) {
    return (
      <p className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-muted">Nothing here right now.</p>
    );
  }
  return <>{children}</>;
}

/** The work queues with the age of the oldest item, plus orgs with unconfirmed places. */
export function QueuesPanel() {
  const [queues, setQueues] = useState<Queues | null>(null);
  const [orgs, setOrgs] = useState<StaleOrg[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: q }, { data: o }] = await Promise.all([
        rumia.GET('/api/v1/ops/queues'),
        rumia.GET('/api/v1/ops/stale-orgs'),
      ]);
      if (!active) return;
      if (!q || !o) {
        setError('We could not load the queues. Check your connection and try again.');
        setLoading(false);
        return;
      }
      setQueues(q as unknown as Queues);
      setOrgs(o as unknown as StaleOrg[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="queues">
        <h2 id="queues" className="text-lg font-semibold text-rum-text">Work queues</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            { label: 'Review', item: queues?.review, hint: 'Places waiting for a decision' },
            { label: 'Reports', item: queues?.reports, hint: 'Open reports from seekers' },
            { label: 'Stale places', item: queues?.stale, hint: 'Not confirmed recently' },
            { label: 'Busy but unverified', item: queues?.unverified_busy, hint: 'In demand, never visited' },
          ] as Array<{ label: string; item?: QueueItem; hint: string }>).map(({ label, item, hint }) => (
            <div key={label} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
              <p className="text-sm text-rum-muted">{label}</p>
              <p className="text-2xl font-semibold text-rum-text">{item ? item.count : '—'}</p>
              <p className="text-sm text-rum-muted">{item ? oldestLabel(item) : '—'} · {hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="stale-orgs">
        <h2 id="stale-orgs" className="text-lg font-semibold text-rum-text">Organisations with unconfirmed places</h2>
        <PanelState loading={loading} error={error} empty={orgs !== null && orgs.length === 0}>
          <ul className="mt-2 space-y-2">
            {(orgs ?? []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-rum-text">{o.name}</p>
                  <p className="text-sm text-rum-muted">
                    {o.unconfirmed} unconfirmed of {o.total}
                    {o.oldest_confirmation ? ` · oldest ${timeAgo(o.oldest_confirmation)}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </PanelState>
      </section>
    </div>
  );
}

/** Places waiting for a decision, with the reason and any duplicate-photo signal. */
export function ReviewPanel() {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/ops/review');
      if (!active) return;
      if (!data) {
        setError('We could not load the review queue. Check your connection and try again.');
        setLoading(false);
        return;
      }
      setRows(data as unknown as ReviewRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  async function decide(id: string, decision: 'approve' | 'request_changes' | 'reject', note?: string) {
    setBusy(`${decision}:${id}`);
    setNotice(null);
    const { error: err } = await rumia.POST('/api/v1/ops/properties/{property_id}/review', {
      params: { path: { property_id: id } },
      body: { decision, note: note || undefined },
    });
    setBusy(null);
    if (err) {
      setNotice(apiError(err, 'That did not work. Try again.'));
      return;
    }
    setNotice(`Decision saved: ${decision === 'approve' ? 'approved' : decision === 'request_changes' ? 'changes requested' : 'rejected'}.`);
    setReload((n) => n + 1);
  }

  async function visit(id: string, note?: string) {
    setBusy(`visit:${id}`);
    setNotice(null);
    const { error: err } = await rumia.POST('/api/v1/ops/properties/{property_id}/visit', {
      params: { path: { property_id: id } },
      body: { note: note || undefined },
    });
    setBusy(null);
    if (err) {
      setNotice('Could not record the visit.');
      return;
    }
    setNotice('Site visit recorded — "Visited by Rumia" for 12 months.');
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-rum-control bg-rum-raised px-4 py-3 text-sm text-rum-text">{notice}</p>}
      <PanelState loading={loading} error={error} empty={rows !== null && rows.length === 0}>
        <ul className="space-y-2">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/p/${r.slug}`} className="text-base font-medium text-rum-text">{r.name}</Link>
                  <p className="text-sm text-rum-muted">
                    {r.kind} · {r.org_name} · updated {timeAgo(r.updated_at)}
                    {r.duplicate_photos > 0 ? ` · ${r.duplicate_photos} duplicate photo${r.duplicate_photos === 1 ? '' : 's'}` : ''}
                    {r.open_reports > 0 ? ` · ${r.open_reports} open report${r.open_reports === 1 ? '' : 's'}` : ''}
                  </p>
                  {r.reason && <p className="mt-1 text-sm text-rum-caution">{r.reason}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-[14rem] flex-1 text-sm text-rum-text">
                  <span className="mb-1 block">Note</span>
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Why, or what needs to change"
                    className="min-h-11 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-sm text-rum-text"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => decide(r.id, 'approve')}
                  disabled={busy === `approve:${r.id}`}
                  className="inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-4 text-sm font-semibold text-rum-on-accent disabled:opacity-60"
                >
                  {busy === `approve:${r.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, 'request_changes', notes[r.id])}
                  disabled={busy === `request_changes:${r.id}` || !(notes[r.id] ?? '').trim()}
                  className="inline-flex min-h-11 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text disabled:opacity-50"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, 'reject', notes[r.id])}
                  disabled={busy === `reject:${r.id}` || !(notes[r.id] ?? '').trim()}
                  className="inline-flex min-h-11 items-center rounded-rum-control border border-rum-danger px-4 text-sm font-semibold text-rum-danger disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => visit(r.id, notes[r.id])}
                  disabled={busy === `visit:${r.id}`}
                  className="inline-flex min-h-11 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text disabled:opacity-60"
                >
                  Record visit
                </button>
              </div>
            </li>
          ))}
        </ul>
      </PanelState>
    </div>
  );
}

const RESOLUTIONS: Array<[string, string]> = [
  ['dismiss', 'Dismiss'],
  ['resolved', 'Resolved'],
  ['remove_listing', 'Remove listing'],
  ['suspend_org', 'Suspend org'],
];

/** Open reports from seekers, highest priority first. */
export function ReportsPanel() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/ops/reports');
      if (!active) return;
      if (!data) {
        setError('We could not load the reports. Check your connection and try again.');
        setLoading(false);
        return;
      }
      setRows(data as unknown as ReportRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  async function resolve(id: string, resolution: string, note?: string) {
    setBusy(`${resolution}:${id}`);
    setNotice(null);
    const { error: err } = await rumia.POST('/api/v1/ops/reports/{report_id}/resolve', {
      params: { path: { report_id: id } },
      body: { resolution, note: note || undefined },
    });
    setBusy(null);
    if (err) {
      setNotice(apiError(err, 'Could not resolve that report.'));
      return;
    }
    setNotice(`Report ${resolution.replace('_', ' ')}.`);
    setReload((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-rum-control bg-rum-raised px-4 py-3 text-sm text-rum-text">{notice}</p>}
      <PanelState loading={loading} error={error} empty={rows !== null && rows.length === 0}>
        <ul className="space-y-2">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rum-text">
                    {r.reason.replace(/_/g, ' ')} · priority {r.priority}
                    {r.same_reason_count > 1 ? ` · ${r.same_reason_count} similar open` : ''}
                  </p>
                  <Link href={`/p/${r.slug}`} className="text-sm text-rum-text underline decoration-rum-line underline-offset-2">{r.name}</Link>
                  {r.details && <p className="mt-1 text-sm text-rum-muted">{r.details}</p>}
                  <p className="text-sm text-rum-muted">{timeAgo(r.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[12rem] flex-1 text-sm text-rum-text">
                    <span className="mb-1 block">Note</span>
                    <input
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Optional note"
                      className="min-h-11 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-sm text-rum-text"
                    />
                  </label>
                  {RESOLUTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => resolve(r.id, value, notes[r.id])}
                      disabled={busy === `${value}:${r.id}`}
                      className={`inline-flex min-h-11 items-center rounded-rum-control border px-3 text-sm font-semibold disabled:opacity-60 ${
                        value === 'suspend_org' ? 'border-rum-danger text-rum-danger' : 'border-rum-line text-rum-text'
                      }`}
                    >
                      {busy === `${value}:${r.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PanelState>
    </div>
  );
}

/** Fresh supply against demand per area, so scouts know where to go. */
export function HealthPanel({ initialMarket = 'nyeri' }: { initialMarket?: string }) {
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [market, setMarket] = useState(initialMarket);
  const [health, setHealth] = useState<MarketHealth | null>(null);
  const [loadedMarket, setLoadedMarket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/markets');
      if (!active) return;
      if (data) setMarkets((data as unknown as MarketOption[]).filter((m) => m.status === 'live'));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!market) return;
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/ops/markets/{market_slug}/health', { params: { path: { market_slug: market } } });
      if (!active) return;
      if (!data) {
        setError('We could not load market health. Check your connection and try again.');
      } else {
        setHealth(data as unknown as MarketHealth);
        setError(null);
      }
      setLoadedMarket(market);
    })();
    return () => {
      active = false;
    };
  }, [market]);

  const loading = loadedMarket !== market;

  return (
    <div className="space-y-4">
      <label className="text-sm text-rum-text">
        <span className="mb-1 block">Market</span>
        <select
          value={market}
          onChange={(e) => {
            setMarket(e.target.value);
            router.push(`/ops/health?market=${e.target.value}`, { scroll: false });
          }}
          className="min-h-11 rounded-rum-control border border-rum-line bg-rum-raised px-3 text-sm text-rum-text"
        >
          {markets.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
      </label>
      <PanelState loading={loading} error={error} empty={false}>
        {health && (
          <>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ['Live', health.live],
                ['Fresh (14 days)', health.fresh],
                ['Stale', health.stale],
                ['Fresh share', `${Math.round(health.fresh_share * 100)}%`],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
                  <p className="text-sm text-rum-muted">{label}</p>
                  <p className="text-2xl font-semibold text-rum-text">{value}</p>
                </div>
              ))}
            </div>
            <h3 className="text-base font-semibold text-rum-text">By area</h3>
            <ul className="space-y-2">
              {health.areas.map((a) => (
                <li key={a.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-rum-text">{a.name}</p>
                    <p className="text-sm text-rum-muted">{a.live} live · {a.fresh} fresh · {a.searches_30d} searches (30d)</p>
                  </div>
                  {a.gap && (
                    <span className="rounded-full bg-rum-caution/10 px-3 py-1 text-sm font-medium text-rum-caution">Gap: demand, little fresh supply</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </PanelState>
    </div>
  );
}
