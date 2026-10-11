import type { Metadata } from 'next';
import { buildMetadata, loadPage, MarketPage, notFoundIfMissing } from '@/lib/seo/market-pages';
import { KIND_BY_SLUG } from '@/lib/seo/kinds';

export const revalidate = 3600; // must be a literal for Next

interface Props { params: Promise<{ market: string; segment: string }> }

/** /{market}/{segment}: a kind (student-hostels, apartments...) or a place (kamakwa...). */
const load = (market: string, segment: string) =>
  KIND_BY_SLUG[segment] ? loadPage(market, undefined, segment) : loadPage(market, segment);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, segment } = await params;
  const d = await load(market, segment);
  return d ? buildMetadata(d) : { title: 'Not found', robots: { index: false } };
}

export default async function MarketSegment({ params }: Props) {
  const { market, segment } = await params;
  return <MarketPage d={notFoundIfMissing(await load(market, segment))} />;
}
