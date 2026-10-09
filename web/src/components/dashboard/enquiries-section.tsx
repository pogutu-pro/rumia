'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rumia } from '@/lib/api/rumia';
import { useWorkspace } from './workspace';

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

const OUTCOME_LABEL = Object.fromEntries(OUTCOMES);

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

/**
 * People who contacted a place, identified by reference code only. Saying what happened ("moved in")
 * is how a fee can be recorded, so it is one tap per enquiry.
 */
export function EnquiriesSection() {
  const { ws, state } = useWorkspace();
  const orgs = ws?.orgs ?? [];
  const [orgId, setOrgId] = useState('');
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const activeOrg = orgId || orgs[0]?.id || '';

  useEffect(() => {
    if (!activeOrg) return;
    let active = true;
    (async () => {
      const res = await rumia.GET('/api/v1/orgs/{org_id}/inquiries', { params: { path: { org_id: activeOrg } } }).catch(() => null);
      if (active) setItems(((res?.data as unknown) as Inquiry[] | undefined) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [activeOrg, tick]);

  const setOutcome = useCallback(
    async (ref: string, outcome: string) => {
      setBusy(ref);
      const res = await rumia
        .POST('/api/v1/orgs/{org_id}/inquiries/{ref_code}/outcome', { params: { path: { org_id: activeOrg, ref_code: ref } }, body: { outcome } })
        .catch(() => null);
      setBusy(null);
      if (!res || res.error) {
        toast.error('Could not save that. Please try again.');
        return;
      }
      toast.success('Saved. Thank you.');
      setTick((n) => n + 1);
    },
    [activeOrg],
  );

  if (state === 'loading' || (state === 'ready' && orgs.length === 0)) return null;
  if (state === 'error') return null;

  return (
    <section aria-labelledby="enquiries-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="enquiries-heading" className="text-sm font-bold text-slate-900">
          Enquiries
        </h2>
        {orgs.length > 1 && (
          <label className="text-xs text-slate-600">
            <span className="sr-only">Organisation</span>
            <select value={activeOrg} onChange={(e) => setOrgId(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs">
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500">Each enquiry has a reference code in the WhatsApp message. Tell us what happened so your places stay accurate.</p>

      {items === null ? (
        <p className="text-sm text-slate-500" role="status">
          Loading enquiries…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No enquiries yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white">
          {items.map((q) => (
            <li key={q.ref_code} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{q.name}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-mono">{q.ref_code}</span> · {q.channel === 'call' ? 'Call' : 'WhatsApp'} · {when(q.created_at)}
                  {q.replied === true && ' · they said you replied'}
                  {q.replied === false && ' · they say no reply yet'}
                </p>
              </div>
              {q.outcome ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{OUTCOME_LABEL[q.outcome] ?? q.outcome}</span>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`What happened with ${q.ref_code}`}>
                  {busy === q.ref_code ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Saving" />
                  ) : (
                    OUTCOMES.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => void setOutcome(q.ref_code, value)}
                        className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
