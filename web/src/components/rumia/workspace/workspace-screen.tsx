'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { BadgeCheck, Clock, Loader2, Plus, TriangleAlert, UserPlus } from 'lucide-react';
import { rumia } from '@/lib/api/rumia';
import { statusLabel } from '@/lib/rumia/format';

interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
}

interface WorkspaceProperty {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  status: string;
  last_confirmed_at: string | null;
  contacts_7d: number;
  awaiting_reply: number;
}

interface Attention {
  property_id: string;
  slug: string;
  name: string;
  kind: 'confirm_availability' | 'resume' | 'finish_draft' | 'reply' | string;
  text: string;
}

interface Workspace {
  orgs: WorkspaceOrg[];
  properties: WorkspaceProperty[];
  attention: Attention[];
}

interface Inquiry {
  ref_code: string;
  channel: string;
  created_at: string;
  replied: boolean | null;
  outcome: string | null;
  name: string;
  slug: string;
}

const OUTCOMES: Array<[string, string]> = [
  ['moved_in', 'Moved in'],
  ['not_suitable', 'Not suitable'],
  ['no_reply', 'No reply'],
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never confirmed';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Never confirmed';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `Confirmed ${mins <= 1 ? 'just now' : `${mins} min ago`}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Confirmed ${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `Confirmed ${days} day${days === 1 ? '' : 's'} ago`;
}

export function WorkspaceScreen() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'auth' | 'other' | null>(null);
  const [activeOrg, setActiveOrg] = useState<string>('');
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [inquiryReload, setInquiryReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, response } = await rumia.GET('/api/v1/me/workspace');
      if (!active) return;
      if (response.status === 401) {
        setError('auth');
        setLoading(false);
        return;
      }
      if (!data) {
        setError('other');
        setLoading(false);
        return;
      }
      const next = data as unknown as Workspace;
      setWs(next);
      setActiveOrg((prev) => prev || next.orgs[0]?.id || '');
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!activeOrg) return;
    let active = true;
    (async () => {
      const { data } = await rumia.GET('/api/v1/orgs/{org_id}/inquiries', { params: { path: { org_id: activeOrg } } });
      if (!active) return;
      setInquiries((data as unknown as Inquiry[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [activeOrg, inquiryReload]);

  async function act(propertyId: string, action: 'confirm' | 'let' | 'pause') {
    setBusy(`${action}:${propertyId}`);
    setNotice(null);
    const path = { property_id: propertyId };
    const res =
      action === 'confirm'
        ? await rumia.POST('/api/v1/properties/{property_id}/confirm', { params: { path } })
        : action === 'let'
          ? await rumia.POST('/api/v1/properties/{property_id}/let', { params: { path }, body: {} })
          : await rumia.POST('/api/v1/properties/{property_id}/pause', { params: { path }, body: {} });
    setBusy(null);
    if (res.error) {
      setNotice('That did not work. Check your connection and try again.');
      return;
    }
    setNotice(action === 'confirm' ? 'Confirmed as still available.' : action === 'let' ? 'Marked as let.' : 'Paused and hidden from search.');
    setReload((n) => n + 1);
  }

  async function setOutcome(orgId: string, refCode: string, outcome: string) {
    setBusy(`outcome:${refCode}`);
    const { error: err } = await rumia.POST('/api/v1/orgs/{org_id}/inquiries/{ref_code}/outcome', {
      params: { path: { org_id: orgId, ref_code: refCode } },
      body: { outcome },
    });
    setBusy(null);
    if (err) {
      setNotice('Could not save that outcome.');
      return;
    }
    setNotice('Outcome saved. Thank you.');
    setInquiryReload((n) => n + 1);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-rum-muted lg:px-8" role="status">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="mt-2">Loading your workspace…</p>
      </div>
    );
  }

  if (error === 'auth') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center lg:px-8">
        <h1 className="text-2xl font-semibold text-rum-text">Sign in to see your workspace</h1>
        <Link href="/auth/login?next=/workspace" className="mt-4 inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-5 font-semibold text-rum-on-accent">
          Sign in
        </Link>
      </div>
    );
  }

  if (error === 'other' || !ws) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center lg:px-8" role="alert">
        <h1 className="text-2xl font-semibold text-rum-text">We could not load your workspace</h1>
        <p className="mt-1 text-rum-muted">Check your connection, then try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            setReload((n) => n + 1);
          }}
          className="mt-4 inline-flex min-h-11 items-center rounded-rum-control border border-rum-line bg-rum-raised px-5 font-semibold text-rum-text"
        >
          Try again
        </button>
      </div>
    );
  }

  const org = ws.orgs.find((o) => o.id === activeOrg) ?? ws.orgs[0] ?? null;
  const hasOrgs = ws.orgs.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rum-text sm:text-3xl">Workspace</h1>
          <p className="text-rum-muted">What needs you today.</p>
        </div>
        <div className="flex items-center gap-2">
          {ws.orgs.length > 1 && (
            <label className="text-sm text-rum-muted">
              <span className="sr-only">Organisation</span>
              <select
                value={activeOrg}
                onChange={(e) => setActiveOrg(e.target.value)}
                className="min-h-11 rounded-rum-control border border-rum-line bg-rum-raised px-3 text-sm text-rum-text"
              >
                {ws.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
          <Link
            href="/dashboard/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-rum-control bg-rum-accent px-5 font-semibold text-rum-on-accent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            List your property
          </Link>
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-rum-control bg-rum-raised px-4 py-3 text-sm text-rum-text">{notice}</p>
      )}

      {!hasOrgs ? (
        <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
          <p className="text-base font-semibold text-rum-text">You have no places yet.</p>
          <p className="mt-1 text-sm text-rum-muted">List a property and it will show up here with what needs confirming.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="today">
            <h2 id="today" className="text-lg font-semibold text-rum-text">Today</h2>
            {ws.attention.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-muted">
                <BadgeCheck className="h-4 w-4 text-rum-positive" aria-hidden="true" />
                Nothing needs attention right now.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {ws.attention.map((a, i) => (
                  <li key={`${a.property_id}-${a.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-3 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-rum-text">
                        <TriangleAlert className="h-4 w-4 shrink-0 text-rum-caution" aria-hidden="true" />
                        {a.text}
                      </p>
                      <Link href={`/p/${a.slug}`} className="text-sm text-rum-muted underline decoration-rum-line underline-offset-2">{a.name}</Link>
                    </div>
                    {a.kind === 'finish_draft' ? (
                      <Link href="/dashboard/listings" className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text">
                        Finish draft
                      </Link>
                    ) : a.kind === 'reply' ? (
                      <a href="#contacts" className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text">
                        Open contacts
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act(a.property_id, 'confirm')}
                        disabled={busy === `confirm:${a.property_id}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-rum-control bg-rum-accent px-4 text-sm font-semibold text-rum-on-accent disabled:opacity-60"
                      >
                        {busy === `confirm:${a.property_id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Still available
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="places">
            <h2 id="places" className="text-lg font-semibold text-rum-text">Your places</h2>
            <ul className="mt-2 space-y-2">
              {ws.properties.map((p) => (
                <li key={p.id} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/p/${p.slug}`} className="text-base font-medium text-rum-text">{p.name}</Link>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-rum-muted">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{timeAgo(p.last_confirmed_at)}</span>
                        <span>{statusLabel(p.status)}</span>
                        <span>{p.contacts_7d} contact{p.contacts_7d === 1 ? '' : 's'} this week</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act(p.id, 'confirm')}
                        disabled={busy === `confirm:${p.id}`}
                        className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => act(p.id, 'let')}
                        disabled={busy === `let:${p.id}`}
                        className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text disabled:opacity-60"
                      >
                        Let
                      </button>
                      <button
                        type="button"
                        onClick={() => act(p.id, 'pause')}
                        disabled={busy === `pause:${p.id}`}
                        className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-4 text-sm font-semibold text-rum-text disabled:opacity-60"
                      >
                        Pause
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="contacts-title" id="contacts">
            <h2 id="contacts-title" className="text-lg font-semibold text-rum-text">Contacts{org ? ` · ${org.name}` : ''}</h2>
            {inquiries === null ? (
              <p className="mt-2 text-sm text-rum-muted">Loading contacts…</p>
            ) : inquiries.length === 0 ? (
              <p className="mt-2 rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3 text-sm text-rum-muted">No contacts yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {inquiries.map((q) => (
                  <li key={q.ref_code} className="rounded-rum-media border border-rum-line bg-rum-raised px-4 py-3" data-testid="inquiry-row">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rum-text">
                          <span className="font-mono">{q.ref_code}</span> · <Link href={`/p/${q.slug}`} className="underline decoration-rum-line underline-offset-2">{q.name}</Link>
                        </p>
                        <p className="text-sm text-rum-muted">
                          {q.channel} · {new Date(q.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                          {q.outcome ? ` · ${OUTCOMES.find(([v]) => v === q.outcome)?.[1] ?? q.outcome}` : q.replied ? ' · replied' : ''}
                        </p>
                      </div>
                      {!q.outcome && org && (
                        <div className="flex flex-wrap gap-2">
                          {OUTCOMES.map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setOutcome(org.id, q.ref_code, value)}
                              disabled={busy === `outcome:${q.ref_code}`}
                              className="inline-flex min-h-10 items-center rounded-rum-control border border-rum-line px-3 text-sm font-medium text-rum-text disabled:opacity-60"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {org && org.role === 'owner' && <AddMember org={org} onDone={() => setNotice('Team member added.')} />}
        </>
      )}
    </div>
  );
}

function AddMember({ org, onDone }: { org: WorkspaceOrg; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await rumia.POST('/api/v1/orgs/{org_id}/members', {
      params: { path: { org_id: org.id } },
      body: { email: email.trim(), role },
    });
    setBusy(false);
    if (err) {
      setError('Could not add them. They need to have signed in to Rumia once, and you must be an owner.');
      return;
    }
    setEmail('');
    onDone();
  }

  return (
    <section aria-labelledby="team" className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
      <h2 id="team" className="text-lg font-semibold text-rum-text">Team</h2>
      <p className="mt-1 text-sm text-rum-muted">Add someone who already has a Rumia account. They can manage places for {org.name}.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-sm text-rum-text">
          <span className="mb-1 block">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-rum-control border border-rum-line bg-rum-surface px-3 text-sm text-rum-text"
            placeholder="name@example.com"
          />
        </label>
        <label className="text-sm text-rum-text">
          <span className="mb-1 block">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="min-h-11 rounded-rum-control border border-rum-line bg-rum-surface px-3 text-sm text-rum-text"
          >
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-rum-control bg-rum-accent px-5 font-semibold text-rum-on-accent disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          Add
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-rum-danger">{error}</p>}
    </section>
  );
}
