import type { Metadata } from 'next';
import { buildMetadata, loadPage, MarketPage, notFoundIfMissing } from '@/lib/seo/market-pages';

export const revalidate = 3600; // must be a literal for Next

interface Props { params: Promise<{ market: string; segment: string; place: string }> }

/** /{market}/{type}/{place}: for example /nyeri/bedsitters/boma. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, segment, place } = await params;
  const d = await loadPage(market, place, segment);
  return d ? buildMetadata(d) : { title: 'Not found', robots: { index: false } };
}

export default async function MarketTypePlace({ params }: Props) {
  const { market, segment, place } = await params;
  return <MarketPage d={notFoundIfMissing(await loadPage(market, place, segment))} />;
}
