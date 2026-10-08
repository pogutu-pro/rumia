import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { AlertPrompt } from '@/components/rumia/explore/alert-prompt';
import { CardGrid } from '@/components/rumia/landing/card-grid';
import { rumiaServer } from '@/lib/api/rumia';
import { filtersHref, parseFilters, toApiQuery } from '@/lib/rumia/explore-params';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

async function load(market: string, landmark: string) {
  const api = rumiaServer();
  const [landmarksRes, searchRes] = await Promise.all([
    api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: market } } }).catch(() => null),
    api
      .GET('/api/v1/discovery/search', {
        params: { query: { ...toApiQuery(parseFilters({ near: landmark }), { limit: 60 }), market } },
      })
      .catch(() => null),
  ]);
  const landmarkMeta = (landmarksRes?.data ?? []).find((l) => l.slug === landmark);
  return { landmarkMeta: landmarkMeta ?? null, result: searchRes?.data ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ market: string; landmark: string }> }): Promise<Metadata> {
  const { market, landmark } = await params;
  const { landmarkMeta } = await load(market, landmark).catch(() => ({ landmarkMeta: null, result: null }));
  if (!landmarkMeta) return { title: 'Not found | Rumia' };
  const short = (landmarkMeta.features as Record<string, string> | null | undefined)?.short_name;
  return {
    title: `Places near ${short ?? landmarkMeta.name} | Rumia`,
    description: `Places to rent within walking distance of ${landmarkMeta.name}, ${market}, with walk times and real move-in costs.`,
    alternates: { canonical: `${SITE}/${market}/near/${landmark}` },
    robots: { index: true, follow: true },
  };
}

export default async function LandmarkPage({ params }: { params: Promise<{ market: string; landmark: string }> }) {
  const { market, landmark } = await params;
  const { landmarkMeta, result } = await load(market, landmark).catch(() => ({ landmarkMeta: null, result: null }));
  if (!landmarkMeta) notFound();

  const name = (landmarkMeta.features as Record<string, string> | null | undefined)?.short_name ?? landmarkMeta.name;
  const cards = result?.items ?? [];
  const here = filtersHref({ near: landmark });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">Places near {name}</h1>
        <p className="flex items-center gap-1 text-base text-rum-muted">
          <MapPin className="h-4 w-4" aria-hidden="true" /> Walking distance · {market}
        </p>
      </header>

      <div className="mt-6">
        {!result ? (
          <div role="alert" className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
            <p className="text-base font-semibold">We could not load these places right now.</p>
            <Link href="/" className="mt-3 inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent">
              Back to search
            </Link>
          </div>
        ) : cards.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6">
              <p className="text-base font-semibold">No places with a confirmed walk to {name} yet.</p>
              <p className="mt-1 text-sm text-rum-muted">
                Try{' '}
                <Link href="/" className="font-medium text-rum-accent underline underline-offset-2">
                  the main search
                </Link>
                , or we can tell you the moment one is.
              </p>
            </div>
            <AlertPrompt filters={parseFilters({ near: landmark })} label={`a new place near ${name}`} />
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-rum-muted">
              {result.total} place{result.total > 1 ? 's' : ''}{' '}
              <Link href={here} className="font-semibold text-rum-accent underline underline-offset-2">
                see all with filters
              </Link>
            </p>
            <CardGrid cards={cards} />
          </>
        )}
      </div>
    </div>
  );
}