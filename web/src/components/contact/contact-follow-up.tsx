'use client';

import { useEffect, useState } from 'react';
import { rumia } from '@/lib/api/rumia';
import { clearFollowUp, dueFollowUp, type PendingFollowUp } from '@/lib/contact';
import { track } from '@/lib/events';

/**
 * After someone returns from WhatsApp, ask once whether the place replied. This is how Rumia learns which
 * listers answer, with no sign-in. Appears inline at the bottom, never as a blocking dialog.
 */
export function ContactFollowUp() {
  const [pending, setPending] = useState<PendingFollowUp | null>(null);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') setPending(dueFollowUp());
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  if (!pending) return null;

  async function answer(replied: 'yes' | 'not_yet' | 'no') {
    const current = pending;
    if (!current) return;
    clearFollowUp(current.ref);
    setPending(null);
    track('contact_followup_answered', { props: { replied } });
    await rumia.POST('/api/v1/inquiries/{ref_code}/followup', { params: { path: { ref_code: current.ref } }, body: { replied } }).catch(() => null);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg lg:bottom-6"
    >
      <p className="text-sm font-semibold text-slate-900">Did {pending.name} reply?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void answer('yes')} className="min-h-11 flex-1 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white">
          Yes
        </button>
        <button type="button" onClick={() => void answer('not_yet')} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-900">
          Not yet
        </button>
        <button type="button" onClick={() => setPending(null)} className="min-h-11 rounded-lg px-3 text-sm text-slate-600" aria-label="Dismiss">
          Later
        </button>
      </div>
    </div>
  );
}
