import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { rumiaServer } from '@/lib/api/rumia';
import { DiscoveryLanding } from '@/components/discovery/landing';

export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

interface Props {
  params: Promise<{ market: string; landmark: string }>;
}

async function load(market: string, landmark: string) {
  const api = rumiaServer({ revalidate });
  const [landmarks, places] = await Promise.all([
    api.GET('/api/v1/markets/{market_slug}/landmarks', { params: { path: { market_slug: market } } }).catch(() => null),
    api.GET('/api/v1/markets/{market_slug}/places', { params: { path: { market_slug: market } } }).catch(() => null),
  ]);
  const all = landmarks?.data ?? [];
  const current = all.find((l) => l.slug === landmark);
  if (!current) return null;
  const search = await api.GET('/api/v1/discovery/search', { params: { query: { market, near: landmark, sort: 'best', limit: 24 } } }).catch(() => null);
  return { current, all, places: places?.data ?? [], cards: search?.data?.items ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, landmark } = await params;
  const data = await load(market, landmark);
  if (!data) return { title: 'Not found | Rumia' };
  return {
    title: `Places to rent near ${data.current.name} | Rumia`,
    description: `Places to rent within walking distance of ${data.current.name}, closest first, with prices and move-in costs.`,
    alternates: { canonical: `${BASE}/near/${market}/${landmark}` },
  };
}

export default async function NearPage({ params }: Props) {
  const { market, landmark } = await params;
  const data = await load(market, landmark);
  if (!data) notFound();
  return (
    <DiscoveryLanding
      title={`Places to rent near ${data.current.name}`}
      intro={`Closest first, with the walking time to ${data.current.name} on each card.`}
      cards={data.cards}
      alert={{ intent: { market, near: landmark }, label: `New places near ${data.current.name}` }}
      related={[
        ...data.all.filter((l) => l.slug !== landmark).slice(0, 6).map((l) => ({ href: `/near/${market}/${l.slug}`, label: `Near ${l.name}` })),
        ...data.places.slice(0, 8).map((p) => ({ href: `/areas/${market}/${p.slug}`, label: p.name })),
      ]}
      relatedTitle="Other landmarks and areas"
    />
  );
}
