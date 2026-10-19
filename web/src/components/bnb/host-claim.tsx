'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { rumia } from '@/lib/api/rumia';
import { extractApiErrorMessage } from '@/lib/api/client';
import { getBrowserSession } from '@/lib/auth/client';

/** Opens an invite link: asks the host to sign in (or create an account) first, then links them to their place. */
export function HostClaim() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<{ kind: 'checking' | 'signin' | 'done' | 'error'; text?: string }>({ kind: 'checking' });

  useEffect(() => {
    let live = true;
    (async () => {
      if (!token) return live && setState({ kind: 'error', text: 'This link is missing its code. Open the link from your message again.' });
      const session = await getBrowserSession().catch(() => null);
      if (!session) return live && setState({ kind: 'signin' });
      const { data, error } = await rumia.POST('/api/v1/host/claim', { body: { token } });
      if (!live) return;
      if (data) setState({ kind: 'done', text: data.org_name });
      else setState({ kind: 'error', text: extractApiErrorMessage(error) ?? 'This invite did not work. Ask us for a new one.' });
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const next = `/host/claim?token=${encodeURIComponent(token)}`;
  return (
    <div>
      <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink">Your host invite</h1>
      {state.kind === 'checking' && <p className="mt-3 text-bnb-stone">Checking your invite…</p>}
      {state.kind === 'signin' && (
        <>
          <p className="mt-3 text-bnb-stone">Sign in, or create an account with your email, to link your place to it.</p>
          <Link href={`/host/sign-in?next=${encodeURIComponent(next)}`} className="mt-6 inline-flex min-h-12 items-center rounded-full bg-bnb-forest px-6 font-semibold text-bnb-mist hover:bg-bnb-pine">
            Continue to sign in
          </Link>
        </>
      )}
      {state.kind === 'done' && (
        <>
          <p className="mt-3 text-bnb-ink">Your account now manages {state.text} on RumiaBnB.</p>
          <Link href="/host" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-bnb-forest px-6 font-semibold text-bnb-mist hover:bg-bnb-pine">
            Open your dashboard
          </Link>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-red-800">
          {state.text}
        </p>
      )}
    </div>
  );
}
