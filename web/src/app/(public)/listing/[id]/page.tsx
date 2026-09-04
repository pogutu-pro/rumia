import { listingsApi } from '@/lib/api/listings';
import { notFound, redirect } from 'next/navigation';

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  
  try {
    const listing = await listingsApi.getByIdServer(id);
    if (listing?.slug) {
      redirect(`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.slug}`);
    }
  } catch (error) {
    // If not found or error, fall through to notFound()
  }

  notFound();
}
