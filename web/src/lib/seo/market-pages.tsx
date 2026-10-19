import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { rumiaServer, type SearchCard } from '@/lib/api/rumia';
import { KIND_BY_SLUG, KIND_PAGES, MIN_INDEXABLE, type KindPage } from '@/lib/seo/kinds';
import { DiscoveryLanding } from '@/components/discovery/landing';
import { cardHref } from '@/components/discovery/card-href';
import { JsonLd } from '@/components/seo/json-ld';
import { BNB_SEPARATE } from '@/lib/site/separation';

const KINDS_PHRASE = BNB_SEPARATE ? 'student hostels, bedsitters and apartments' : 'student hostels, bedsitters, apartments and short stays';

export const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
export const PAGE_REVALIDATE = 3600;

export interface PageData {
  market: { slug: string; name: string };
  place?: { slug: string; name: string };
  kind?: KindPage;
  cards: SearchCard[];
  total: number;
  places: Array<{ slug: string; name: string; listing_count?: number | null }>;
  landmarks: Array<{ slug: string; name: string }>;
}

/** Loads one market page (hub, kind, place, or place + kind). Returns null when the market, place or kind does not exist. */
export async function loadPage(marketSlug: string, placeSlug?: string, kindSlug?: string): Promise<PageData | null> {
  const api = rumiaServer({ revalidate: PAGE_REVALIDATE });
  const markets = (await api.GET('/api/v1/markets').catch(() => null))?.data ?? [];
  const market = markets.find((m) => m.slug === marketSlug);
  if (!market) return null;
  const kind = kindSlug ? KIND_BY_SLUG[kindSlug] : undefined;
  if (kindSlug && !kind) return null;
  const [placesRes, landmarksRes] = await Promise.all([
    api.GET('/api/v1/markets/{market_slug}/places', { params: { path: { market_slug: marketSlug } } }).catch(() => null),
    api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: marketSlug } } }).catch(() => null),
  ]);
  const places = placesRes?.data ?? [];
  const place = placeSlug ? places.find((p) => p.slug === placeSlug) : undefined;
  if (placeSlug && !place) return null;
  const search = await api
    .GET('/api/v1/discovery/search', {
      params: { query: { market: marketSlug, place: placeSlug, limit: 24, ...(kind?.query ?? {}) } },
    })
    .catch(() => null);
  return {
    market: { slug: market.slug, name: market.name },
    place: place ? { slug: place.slug, name: place.name } : undefined,
    kind,
    cards: search?.data?.items ?? [],
    total: search?.data?.total ?? 0,
    places,
    landmarks: landmarksRes?.data ?? [],
  };
}

export function pathFor(d: Pick<PageData, 'market' | 'place' | 'kind'>): string {
  return ['', d.market.slug, d.kind?.slug, d.place?.slug].filter((s) => s !== undefined && s !== null).join('/') || '/';
}

function priceRange(cards: SearchCard[]): { min: number; max: number; period: string } | null {
  const priced = cards.filter((c) => typeof c.from_price === 'number' && c.from_price > 0);
  if (!priced.length) return null;
  const prices = priced.map((c) => c.from_price as number);
  return { min: Math.min(...prices), max: Math.max(...prices), period: priced[0].price_period === 'night' ? 'night' : 'month' };
}

const kes = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`;

function headline(d: PageData): string {
  const where = d.place ? `${d.place.name}, ${d.market.name}` : d.market.name;
  if (d.kind) return `${d.kind.label} in ${where}`;
  return d.place ? `Places to rent in ${where}` : `Places to rent in ${d.market.name}`;
}

export function buildMetadata(d: PageData): Metadata {
  const title = headline(d);
  const range = priceRange(d.cards);
  const count = d.total || d.cards.length;
  const where = `${d.place ? `${d.place.name}, ` : ''}${d.market.name}`;
  const lead = d.kind
    ? `${count > 0 ? `${count} ` : ''}${d.kind.phrase} in ${where}`
    : `${count > 0 ? `${count} places` : 'Places'} to rent in ${where}: ${KINDS_PHRASE}`;
  const description = `${lead}${range ? `, from ${kes(range.min)} a ${range.period}` : ''}, with move-in costs and when each place was last confirmed.`;
  const indexable = count >= MIN_INDEXABLE;
  const url = `${BASE}${pathFor(d)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${title} | Rumia`, description, url, type: 'website' },
  };
}

function intro(d: PageData): string {
  const where = d.place ? `${d.place.name}, ${d.market.name}` : d.market.name;
  const range = priceRange(d.cards);
  const base = d.kind
    ? `${d.kind.blurb} Showing ${d.kind.phrase} in ${where}.`
    : `${KINDS_PHRASE.charAt(0).toUpperCase()}${KINDS_PHRASE.slice(1)} in ${where}.`;
  const tail = range
    ? ` Prices here run from ${kes(range.min)} to ${kes(range.max)} a ${range.period}; each place shows when its owner last confirmed it.`
    : ' Each place shows when its owner last confirmed it.';
  return base + tail;
}

function faq(d: PageData): Array<{ q: string; a: string }> {
  const where = d.place ? `${d.place.name}, ${d.market.name}` : d.market.name;
  const what = d.kind?.phrase ?? 'places to rent';
  const range = priceRange(d.cards);
  const out: Array<{ q: string; a: string }> = [];
  if (range) {
    out.push({
      q: `How much are ${what} in ${where}?`,
      a: `On Rumia right now, ${what} in ${where} run from ${kes(range.min)} to ${kes(range.max)} a ${range.period}. Prices come from the listings and are checked against what owners confirm.`,
    });
  }
  if ((d.total || d.cards.length) > 0) {
    out.push({
      q: `How many ${what} are listed in ${where}?`,
      a: `${d.total || d.cards.length} ${what} are listed in ${where} at the moment. The list changes as owners confirm or pause their places.`,
    });
  }
  return out;
}

export function MarketPage({ d }: { d: PageData }) {
  const path = pathFor(d);
  const title = headline(d);
  const crumbs = [
    { name: 'Rumia', url: BASE },
    { name: d.market.name, url: `${BASE}/${d.market.slug}` },
    ...(d.kind ? [{ name: d.kind.label, url: `${BASE}/${d.market.slug}/${d.kind.slug}` }] : []),
    ...(d.place ? [{ name: d.place.name, url: `${BASE}${path}` }] : []),
  ];
  const questions = faq(d);
  const m = d.market.slug;
  
  const related = [
    ...KIND_PAGES.filter((k) => k.slug !== d.kind?.slug).map((k) => ({ href: d.place ? `/${m}/${k.slug}/${d.place.slug}` : `/${m}/${k.slug}`, label: k.label })),
    ...(d.place || d.kind
      ? d.places.filter((p) => p.slug !== d.place?.slug && (p.listing_count ?? 0) > 0).slice(0, 8).map((p) => ({
          href: d.kind ? `/${m}/${d.kind.slug}/${p.slug}` : `/${m}/${p.slug}`,
          label: p.name,
        }))
      : d.places.filter((p) => (p.listing_count ?? 0) > 0).slice(0, 12).map((p) => ({ href: `/${m}/${p.slug}`, label: p.name }))),
    ...d.landmarks.slice(0, 6).map((l) => ({ href: `/near/${m}/${l.slug}`, label: `Near ${l.name}` })),
  ];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BreadcrumbList',
              itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
            },
            {
              '@type': 'CollectionPage',
              name: title,
              url: `${BASE}${path}`,
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: d.cards.length,
                itemListElement: d.cards.map((c, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: `${BASE}${cardHref(c)}`,
                  name: c.name,
                })),
              },
            },
            ...(questions.length
              ? [{
                  '@type': 'FAQPage',
                  mainEntity: questions.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
                }]
              : []),
          ],
        }}
      />
      <DiscoveryLanding
        title={title}
        intro={intro(d)}
        cards={d.cards}
        alert={{
          intent: {
            market: m,
            ...(d.place ? { places: [d.place.slug] } : {}),
            ...(d.kind?.query.kind ? { kind: d.kind.query.kind } : {}),
          },
          label: `New ${d.kind?.phrase ?? 'places'} in ${d.place?.name ?? d.market.name}`,
        }}
        related={related}
        relatedTitle="Explore more"
      >
        {questions.length > 0 && (
          <section className="mt-8 max-w-2xl" aria-label="Frequently asked questions">
            {questions.map((x) => (
              <div key={x.q} className="mt-3">
                <h2 className="text-sm font-bold text-slate-900">{x.q}</h2>
                <p className="mt-1 text-sm text-slate-600">{x.a}</p>
              </div>
            ))}
          </section>
        )}
      </DiscoveryLanding>
    </>
  );
}

export function notFoundIfMissing<T>(d: T | null): T {
  if (!d) notFound();
  return d as T;
}
