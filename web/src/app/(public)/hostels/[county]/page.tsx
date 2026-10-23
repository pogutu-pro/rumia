import { permanentRedirect } from 'next/navigation';

/** Old county address (/hostels/nyeri): the market page is /nyeri now. */
export default async function LegacyCountyPage({ params }: { params: Promise<{ county: string }> }) {
  const { county } = await params;
  permanentRedirect(`/${encodeURIComponent(county.toLowerCase())}`);
}
