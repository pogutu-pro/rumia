'use client';

import { useRef, useState } from 'react';
import { rumia } from '@/lib/api/rumia';

const REASONS: Array<[string, string]> = [
  ['not_available', 'It is not available any more'],
  ['wrong_price', 'The price is wrong'],
  ['scam', 'It looks like a scam'],
  ['wrong_location', 'The location is wrong'],
  ['other', 'Something else'],
];

/** "Report this listing": a plain text link that opens a small form. Repeated reports act automatically. */
export function ReportButton({ slug }: { slug: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('not_available');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const res = await rumia
      .POST('/api/v1/properties/{slug}/reports', { params: { path: { slug } }, body: { reason, details: details || null } })
      .catch(() => null);
    setState(res && !res.error ? 'done' : 'error');
  }

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="text-sm text-rum-muted underline underline-offset-2 hover:text-rum-text">
        Report this listing
      </button>
      <dialog ref={ref} aria-labelledby="report-title" className="w-[min(92vw,26rem)] rounded-rum-media bg-rum-raised p-5 text-rum-text backdrop:bg-black/40">
        {state === 'done' ? (
          <div>
            <p id="report-title" className="text-base font-semibold">Thank you</p>
            <p className="mt-1 text-sm text-rum-muted">We will check this place. Reports from different people act quickly.</p>
            <button type="button" onClick={() => ref.current?.close()} className="mt-4 min-h-11 rounded-rum-control bg-rum-accent px-4 text-sm font-semibold text-rum-on-accent">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p id="report-title" className="text-base font-semibold">What is wrong?</p>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Reason</legend>
              {REASONS.map(([value, label]) => (
                <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="h-4 w-4 accent-rum-accent" />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm">
              <span className="text-rum-muted">Details (optional)</span>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-rum-control border border-rum-line bg-rum-surface p-2 text-base" />
            </label>
            {state === 'error' && <p role="alert" className="mt-2 text-sm text-rum-danger">Could not send. Please try again.</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={state === 'sending'} className="min-h-11 flex-1 rounded-rum-control bg-rum-accent px-4 text-sm font-semibold text-rum-on-accent disabled:opacity-70">
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
              <button type="button" onClick={() => ref.current?.close()} className="min-h-11 rounded-rum-control border border-rum-line px-4 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
