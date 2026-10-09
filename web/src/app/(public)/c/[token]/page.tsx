'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, Link2Off } from 'lucide-react';
import { rumia, type ActionPreview } from '@/lib/api/rumia';

type Stage = 'loading' | 'preview' | 'done' | 'error';

const COPY: Record<string, { heading: (name: string) => string; body: string; button: string }> = {
  confirm: {
    heading: (name) => `Is ${name} still available?`,
    body: 'Confirm it is still taking tenants so it stays listed as available.',
    button: "It's still available",
  },
  let: {
    heading: (name) => `Was ${name} let?`,
    body: 'Mark it as let so we stop showing it as available.',
    button: "It's let",
  },
  pause: {
    heading: (name) => `Pause ${name}?`,
    body: 'Hide it for now without removing the place. You can bring it back any time.',
    button: 'Pause it for now',
  },
};

export default function ConfirmActionPage() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [action, setAction] = useState<string>('');
  const [performing, setPerforming] = useState(false);

  // GET only previews — the signed link never changes anything on its own (ux/04 §5).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await rumia
        .GET('/api/v1/actions/{token}', { params: { path: { token } } })
        .catch(() => ({ data: undefined }));
      if (!active) return;
      if (!data) {
        setStage('error');
        return;
      }
      setPreview(data);
      setAction(data.action);
      setStage('preview');
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function perform() {
    if (performing || !preview) return;
    setPerforming(true);
    const res = await rumia
      .POST('/api/v1/actions/{token}', { params: { path: { token } } })
      .catch(() => null);
    setPerforming(false);
    if (res && !res.error) setStage('done');
    else setStage('error');
  }

  if (stage === 'loading') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center" role="status" aria-live="polite" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-base text-slate-500">Checking this link…</p>
      </div>
    );
  }

  if (stage === 'error' || !preview) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10">
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm p-6 text-center">
          <Link2Off className="mx-auto h-6 w-6 text-slate-500" aria-hidden="true" />
          <h1 className="mt-2 text-xl font-semibold text-slate-900">This link has expired or is not valid.</h1>
          <p className="mt-1 text-sm text-slate-500">Ask the lister for a fresh link, or message them through the place.</p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const copy = COPY[action] ?? COPY.confirm;

  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm p-6">
        {stage === 'done' ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-2 text-xl font-semibold text-slate-900">Thanks — done.</h1>
            <p className="mt-1 text-sm text-slate-500">
              {action === 'confirm' && `${preview.property_name} is listed as available again.`}
              {action === 'let' && `${preview.property_name} is marked as let.`}
              {action === 'pause' && `${preview.property_name} is paused for now.`}
            </p>
            <Link href={`/p/${preview.property_slug}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white">
              View place
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Owner link</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-slate-900">{copy.heading(preview.property_name)}</h1>
            <p className="mt-1 text-sm text-slate-500">{copy.body}</p>
            <button
              type="button"
              disabled={performing}
              onClick={perform}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-semibold text-white disabled:opacity-70"
            >
              {performing && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {performing ? 'Working…' : copy.button}
            </button>
            <Link href={`/p/${preview.property_slug}`} className="mt-3 block text-center text-sm font-semibold text-emerald-700 underline underline-offset-2">
              See the place first
            </Link>
          </>
        )}
      </div>
    </div>
  );
}