'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { getSession } from '@/lib/supabase/auth';
import { rumia, type SearchCard } from '@/lib/api/rumia';
import { DiscoveryCard } from '@/components/discovery/search-card';
import { AlertsList } from '@/components/discovery/alerts-list';

type State = { kind: 'loading' } | { kind: 'ready'; cards: SearchCard[] } | { kind: 'error' };

/**
 * Saved places for someone who has not signed in (kept for this browser). Signed-in people have the
 * fuller Saved tab in their account, so they are sent there.
 */
export function SavedPlaces() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const { session } = await getSession().catch(() => ({ session: null }));
      if (!active) return;
      if (session?.user) {
        router.replace('/account?tab=saved');
        return;
      }
      try {
        const saved = await rumia.GET('/api/v1/saves');
        const ids = (saved.data?.listing_ids ?? []).slice(0, 50);
        if (ids.length === 0) {
          if (active) setState({ kind: 'ready', cards: [] });
          return;
        }
        const cards = await rumia.GET('/api/v1/discovery/cards', { params: { query: { ids: ids.join(',') } } });
        if (active) setState({ kind: 'ready', cards: cards.data?.items ?? [] });
      } catch {
        if (active) setState({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Saved places</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kept on this device.{' '}
        <Link href="/auth/login?next=/saved" className="font-semibold text-emerald-700 underline underline-offset-2">
          Sign in
        </Link>{' '}
        to keep them across your devices.
      </p>

      <section aria-labelledby="saved-heading" className="mt-6">
        <h2 id="saved-heading" className="sr-only">
          Your saved places
        </h2>
        {state.kind === 'loading' && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-busy="true" aria-label="Loading saved places">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}
        {state.kind === 'error' && <p className="text-sm text-slate-600">We could not load your saved places. Check your connection and refresh.</p>}
        {state.kind === 'ready' && state.cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Heart className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="mt-2 font-semibold text-slate-900">Nothing saved yet</p>
            <p className="mt-1 text-sm text-slate-500">Tap the heart on a place to keep it here.</p>
            <Link href="/hostels" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">
              Browse places
            </Link>
          </div>
        )}
        {state.kind === 'ready' && state.cards.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {state.cards.map((card) => (
              <DiscoveryCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="alerts-heading" className="mt-10">
        <h2 id="alerts-heading" className="mb-3 text-lg font-bold text-slate-900">
          Alerts
        </h2>
        <AlertsList />
      </section>
    </div>
  );
}
