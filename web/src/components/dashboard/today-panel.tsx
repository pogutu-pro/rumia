'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { confirmAvailable, useWorkspace } from './workspace';

/** What needs the lister's attention today, with a one-tap answer where there is one. Hidden when all is well. */
export function TodayPanel() {
  const { ws, state, reload } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);

  if (state !== 'ready' || !ws || ws.attention.length === 0) return null;

  async function confirm(propertyId: string) {
    setBusy(propertyId);
    const ok = await confirmAvailable(propertyId);
    setBusy(null);
    if (!ok) {
      toast.error('That did not work. Check your connection and try again.');
      return;
    }
    toast.success('Confirmed as still available.');
    reload();
  }

  return (
    <section aria-labelledby="today-heading" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <h2 id="today-heading" className="text-sm font-bold text-slate-900">
          Needs your attention
        </h2>
      </div>
      <ul className="mt-3 space-y-2">
        {ws.attention.map((a, i) => (
          <li key={`${a.property_id}-${a.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-200/70">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{a.text}</p>
              <p className="truncate text-xs text-slate-500">{a.name}</p>
            </div>
            {a.kind === 'finish_draft' ? (
              <Link href="/dashboard/listings" className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-900">
                Open listings
              </Link>
            ) : a.kind === 'reply' ? (
              <Link href="/dashboard/leads" className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-900">
                See enquiries
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy === a.property_id}
                onClick={() => void confirm(a.property_id)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-70"
              >
                {busy === a.property_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {a.kind === 'resume' ? 'Show it again' : "It's still available"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
