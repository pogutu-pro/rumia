import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { rumiaServer } from '@/lib/api/rumia';
import { DiscoveryLanding } from '@/components/discovery/landing';

export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

interface Props {
  params: Promise<{ market: string; place: string }>;
}

async function load(market: string, place: string) {
  const api = rumiaServer({ revalidate });
  const [places, landmarks] = await Promise.all([
    api.GET('/api/v1/markets/{market_slug}/places', { params: { path: { market_slug: market } } }).catch(() => null),
    api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: market } } }).catch(() => null),
  ]);
  const all = places?.data ?? [];
  const current = all.find((p) => p.slug === place);
  if (!current) return null;
  const search = await api.GET('/api/v1/discovery/search', { params: { query: { market, place, limit: 24 } } }).catch(() => null);
  return { current, all, landmarks: landmarks?.data ?? [], cards: search?.data?.items ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, place } = await params;
  const data = await load(market, place);
  if (!data) return { title: 'Not found' };
  const title = `Places to rent in ${data.current.name}`;
  return {
    title,
    description: `${data.cards.length || 'Verified'} places to rent in ${data.current.name}, with prices, move-in costs and when each was last confirmed.`,
    alternates: { canonical: `${BASE}/areas/${market}/${place}` },
  };
}

export default async function AreaPage({ params }: Props) {
  const { market, place } = await params;
  const data = await load(market, place);
  if (!data) notFound();
  return (
    <DiscoveryLanding
      title={`Places to rent in ${data.current.name}`}
      intro={`Hostels, bedsitters and apartments in ${data.current.name}. Every price is the monthly rent, and each place shows when its owner last confirmed it.`}
      cards={data.cards}
      alert={{ intent: { market, places: [place] }, label: `New places in ${data.current.name}` }}
      related={[
        ...data.all.filter((p) => p.slug !== place).slice(0, 8).map((p) => ({ href: `/areas/${market}/${p.slug}`, label: p.name })),
        ...data.landmarks.slice(0, 6).map((l) => ({ href: `/near/${market}/${l.slug}`, label: `Near ${l.name}` })),
      ]}
      relatedTitle="Other areas and landmarks"
    />
  );
}
