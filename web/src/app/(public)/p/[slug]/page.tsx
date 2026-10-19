import { notFound, redirect } from 'next/navigation';
import { listingsApi } from '@/lib/api/listings';
import { listingPath } from '@/lib/utils/listing-path';
import { BNB_SEPARATE, bnbStayUrl } from '@/lib/site/separation';

/**
 * Short link used in emails and messages (`/p/<slug>`). It sends the visitor to the property's page,
 * wherever that lives, so links already sent keep working.
 */
export default async function ShortPropertyLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await listingsApi.getByIdServer(slug).catch(() => null);
  if (!listing) notFound();
  if (BNB_SEPARATE && listing.property_type === 'short_stay') redirect(bnbStayUrl(listing.slug || slug));
  redirect(listingPath({ ...listing, slug: listing.slug || slug }));
}
