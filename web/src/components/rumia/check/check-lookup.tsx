'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Phone, CreditCard, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { publicApi, type VerifyCandidate } from '@/lib/api/public';

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 3)}••••${digits.slice(-2)}`;
}

/** /check: "check anything before you pay" — one search box backed by /public/verify-lookup. */
export function CheckLookup() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [candidates, setCandidates] = useState<VerifyCandidate[] | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3 || state === 'loading') return;
    setState('loading');
    try {
      const rows = await publicApi.lookupVerifyCandidates(q);
      setCandidates(rows ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="check-query">
          Phone number, M-Pesa detail or hostel name
        </label>
        <input
          id="check-query"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (state === 'ready') setState('idle');
          }}
          minLength={3}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          placeholder="Phone number, M-Pesa detail or hostel name"
          className="min-h-12 flex-1 rounded-rum-control border border-rum-line bg-rum-surface px-3 text-base text-rum-text placeholder:text-rum-muted focus:border-rum-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent disabled:opacity-70"
        >
          {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          Check
        </button>
      </form>

      <p className="mt-2 text-sm text-rum-muted">Checks anything: a phone number, M-Pesa details, or a hostel name.</p>

      {state === 'error' && (
        <p role="alert" className="mt-4 rounded-rum-control bg-rum-danger/10 px-3 py-2 text-sm text-rum-danger">
          The check could not be completed. Please try again in a moment.
        </p>
      )}

      {state === 'ready' && candidates && (
        <div className="mt-6 space-y-3">
          {candidates.length === 0 ? (
            <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
              <ShieldAlert className="mx-auto h-6 w-6 text-rum-caution" aria-hidden="true" />
              <h2 className="mt-2 text-base font-semibold text-rum-text">Nothing on file for that</h2>
              <p className="mt-1 text-sm text-rum-muted">
                Rumia has no record matching what you entered. Proceed with caution — ask for a viewing first and{' '}
                <Link href="/verify/report" className="font-semibold text-rum-accent underline underline-offset-2">
                  report anything suspicious
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {candidates.map((c) => (
                <li key={c.id} className="rounded-rum-media border border-rum-line bg-rum-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-rum-text">{c.title}</h2>
                      {c.verified ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-rum-positive">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verified by Rumia
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-rum-muted">Not verified yet</p>
                      )}
                    </div>
                    {c.slug && (
                      <Link
                        href={`/p/${c.slug}`}
                        className="shrink-0 text-sm font-semibold text-rum-accent underline underline-offset-2"
                      >
                        View place
                      </Link>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {(c.landlord_phone || c.agent_phone || c.agent_whatsapp) && (
                      <div className="flex items-center gap-2 text-rum-text">
                        <Phone className="h-4 w-4 shrink-0 text-rum-muted" aria-hidden="true" />
                        <dd>
                          {maskPhone(c.landlord_phone || c.agent_phone)}
                          {c.agent_whatsapp && c.agent_whatsapp !== c.landlord_phone && ` · WhatsApp ${maskPhone(c.agent_whatsapp)}`}
                          {c.agent_verified && !c.verified ? ' · agent verified' : ''}
                        </dd>
                      </div>
                    )}
                    {c.mpesa_details && (
                      <div className="flex items-center gap-2 text-rum-text">
                        <CreditCard className="h-4 w-4 shrink-0 text-rum-muted" aria-hidden="true" />
                        <dd>{c.mpesa_details}</dd>
                      </div>
                    )}
                  </dl>
                  {c.area && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-rum-muted">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      {[c.county, c.area, c.specific_location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}