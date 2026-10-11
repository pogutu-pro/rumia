import { notFound, permanentRedirect } from 'next/navigation';
import { getBnbListing } from '../bnb-detail';
import { listingPath } from '@/lib/utils/listing-path';

export const revalidate = 300;

/** The old short-stay URL (/bnb/{id}). It carried no name; the page now lives at /{market}/short-stays/{place}/{name}. */
export default async function LegacyBnbRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getBnbListing(id);
  if (!listing) notFound();
  permanentRedirect(listingPath({ ...listing, property_type: 'short_stay' }));
}
