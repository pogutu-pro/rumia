import type { Metadata } from 'next';
import { buildMetadata, loadPage, MarketPage, notFoundIfMissing } from '@/lib/seo/market-pages';

export const revalidate = 3600; // must be a literal for Next

interface Props { params: Promise<{ market: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market } = await params;
  const d = await loadPage(market);
  return d ? buildMetadata(d) : { title: 'Not found', robots: { index: false } };
}

export default async function MarketHub({ params }: Props) {
  const { market } = await params;
  return <MarketPage d={notFoundIfMissing(await loadPage(market))} />;
}
