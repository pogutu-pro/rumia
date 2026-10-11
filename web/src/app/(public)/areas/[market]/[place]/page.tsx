import { permanentRedirect } from 'next/navigation';

interface Props { params: Promise<{ market: string; place: string }> }

/** The old area URL. The page now lives at /{market}/{place}; a 308 keeps whatever ranking the old URL had. */
export default async function LegacyAreaPage({ params }: Props) {
  const { market, place } = await params;
  permanentRedirect(`/${market}/${place}`);
}
