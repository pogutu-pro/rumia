import { notFound, permanentRedirect } from 'next/navigation';
import { listingsApi } from '@/lib/api/listings';
import { listingPath } from '@/lib/utils/listing-path';

export const revalidate = 300;

/** The old listing URL (/hostels/{county}/{area}/{name}). Every place now lives at /{market}/{type}/{place}/{name}. */
export default async function LegacyHostelListingRedirect({ params }: { params: Promise<{ county: string; area: string; slug: string }> }) {
  const { slug } = await params;
  const listing = await listingsApi.getByIdServer(slug).catch(() => null);
  if (!listing || !listing.is_active) notFound();
  permanentRedirect(listingPath({ ...listing, slug: listing.slug || slug }));
}
