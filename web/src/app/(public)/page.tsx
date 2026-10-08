import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/json-ld';
import { AlertPrompt } from '@/components/rumia/explore/alert-prompt';
import { ExploreControls } from '@/components/rumia/explore/explore-controls';
import { ExploreMemory } from '@/components/rumia/explore/explore-memory';
import { ExploreResults } from '@/components/rumia/explore/results';
import { ReturningStrip } from '@/components/rumia/explore/returning-strip';
import { rumiaServer } from '@/lib/api/rumia';
import { chipsFor, filtersHref, parseFilters, toApiQuery } from '@/lib/rumia/explore-params';

// Search pages are cached briefly at the edge (the API sets Cache-Control); the shell is rendered per request.
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
const MARKET = 'nyeri';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  const refined = Boolean(f.q || f.place.length || f.kind || f.unit_kind.length || f.max_price || f.near);
  return {
    title: 'Rumia · Real places to rent in Nyeri, confirmed by owners',
    description: 'Find hostels, bedsitters, apartments and short stays in Nyeri. Every place shows when the owner last confirmed it is available, what it really costs to move in, and one tap to WhatsApp.',
    alternates: { canonical: SITE },
    robots: refined ? { index: false, follow: true } : undefined,
  };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const api = rumiaServer();

  const [search, placesRes, landmarksRes] = await Promise.all([
    api.GET('/api/v1/discovery/search', { params: { query: toApiQuery(filters, { limit: 12 }) } }).catch(() => null),
    api.GET('/api/v1/markets/{market_slug}/places', { params: { path: { market_slug: MARKET } } }).catch(() => null),
    api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: MARKET } } }).catch(() => null),
  ]);

  const places = (placesRes?.data ?? []).filter((p) => p.kind === 'neighbourhood');
  const landmarks = landmarksRes?.data ?? [];
  const result = search?.data;
  const failed = !result;

  // What the server actually applied (explicit filters plus anything understood from the typed words).
  const applied = result?.applied as Record<string, unknown> | undefined;
  const effective = applied
    ? parseFilters({
        q: String(applied.q ?? ''),
        mode: String(applied.mode ?? 'monthly'),
        place: (applied.places as string[] | undefined)?.join(','),
        kind: applied.kind as string | undefined,
        unit_kind: (applied.unit_kind as string[] | undefined)?.join(','),
        min_price: applied.min_price !== undefined ? String(applied.min_price) : undefined,
        max_price: applied.max_price !== undefined ? String(applied.max_price) : undefined,
        amenities: (applied.amenities as string[] | undefined)?.join(','),
        near: applied.near as string | undefined,
        has_video: applied.has_video ? 'true' : undefined,
        gender: applied.gender as string | undefined,
        sort: filters.sort,
      })
    : filters;

  const chips = chipsFor(effective, places, landmarks);
  const refined = chips.length > 0 || Boolean(effective.q);
  const label = [...chips.map((c) => c.label), effective.q].filter(Boolean).join(' · ') || 'places in Nyeri';
  const here = filtersHref(filters);

  // Starting points come from what is actually in the market, not from a fixed list.
  const starts: Array<{ href: string; label: string }> = [];
  if (landmarks[0]) starts.push({ href: filtersHref({ near: landmarks[0].slug }), label: `Near ${landmarks[0].features && (landmarks[0].features as Record<string, string>).short_name ? (landmarks[0].features as Record<string, string>).short_name : landmarks[0].name}` });
  for (const p of places.filter((p) => p.listing_count > 0).slice(0, 2)) starts.push({ href: filtersHref({ place: [p.slug] }), label: p.name });
  starts.push({ href: filtersHref({ kind: 'apartment' }), label: 'Apartments' });
  starts.push({ href: filtersHref({ mode: 'nightly' }), label: 'Stay a few nights' });

  return (
    <div className="bg-rum-surface">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Rumia', url: SITE, potentialAction: { '@type': 'SearchAction', target: `${SITE}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }} />
      <ExploreMemory href={here} label={label} active={refined && !failed && (result?.total ?? 0) > 0} />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-5 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">Places to rent in Nyeri, confirmed by owners.</h1>
          <p className="text-base text-rum-muted">See what it really costs to move in, and message the owner on WhatsApp.</p>
        </header>

        <ExploreControls filters={effective} places={places} landmarks={landmarks} total={result?.total ?? 0} />

        {!refined && (
          <nav aria-label="Ways to start" className="rum-scroll-x -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {starts.map((s) => (
              <Link key={s.href} href={s.href} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-rum-line bg-rum-raised px-4 text-sm font-medium text-rum-text">
                {s.label}
              </Link>
            ))}
          </nav>
        )}

        {!refined && <ReturningStrip currentHref={here} />}

        {failed ? (
          <div role="alert" className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
            <p className="text-base font-semibold">We could not load places right now.</p>
            <p className="mt-1 text-sm text-rum-muted">Check your connection, then try again.</p>
            <Link href={here} className="mt-4 inline-flex min-h-11 items-center rounded-rum-control bg-rum-accent px-5 text-base font-semibold text-rum-on-accent">
              Try again
            </Link>
          </div>
        ) : result.total === 0 ? (
          <div className="space-y-4">
            <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6">
              <p className="text-base font-semibold">No places match all of that.</p>
              {result.relaxations.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {result.relaxations.map((r) => (
                    <li key={r.label}>
                      <Link
                        href={filtersHref({
                          ...effective,
                          ...(r.change.max_price ? { max_price: String(r.change.max_price) } : {}),
                          ...('places' in r.change ? { place: r.change.places as string[] } : {}),
                          ...('unit_kind' in r.change ? { unit_kind: r.change.unit_kind as string[] } : {}),
                          ...('amenities' in r.change ? { amenities: r.change.amenities as string[] } : {}),
                        })}
                        className="inline-flex min-h-11 items-center text-base font-semibold text-rum-accent underline underline-offset-2"
                      >
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-rum-muted">Try removing a filter, or ask us to tell you when one is listed.</p>
              )}
            </div>
            <AlertPrompt filters={effective} label={label} />
          </div>
        ) : (
          <>
            {result.total < 5 && result.relaxations.length > 0 && (
              <div className="rounded-rum-media bg-rum-sunken p-4 text-sm">
                <p className="font-semibold">Close to your search</p>
                <ul className="mt-1">
                  {result.relaxations.map((r) => (
                    <li key={r.label} className="py-0.5">{r.label}</li>
                  ))}
                </ul>
              </div>
            )}
            <ExploreResults filters={effective} initial={result.items} total={result.total} nextCursor={result.next_cursor ?? null} />
            {refined && <AlertPrompt filters={effective} label={label} />}
          </>
        )}
      </div>
    </div>
  );
}
