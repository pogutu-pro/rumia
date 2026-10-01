import { listingsApi } from '@/lib/api/listings';
import { toLegacyListingShape } from '@/lib/api/legacy-listing';
import { notFound, redirect } from 'next/navigation';
import { AdminEditForm } from './admin-edit-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface AdminEditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditListingPage({
  params,
}: AdminEditListingPageProps) {
  const { id } = await params;
  // Admin read: includes inactive listings; 404 when missing.
  const apiListing = await listingsApi.getByIdAuthenticatedServer(id).catch(() => null);
  if (!apiListing) {
    notFound();
  }
  const agent = apiListing.agent;
  // The form reads the legacy `listing_images` / `listing_room_types` keys.
  const listing = toLegacyListingShape(apiListing);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Admin editing &middot; {agent?.name || 'Unknown agent'}
        </p>
      </div>

      <AdminEditForm
        agentId={agent?.id || ''}
        agentWhatsapp={agent?.whatsapp || agent?.phone || ''}
        initialListing={listing as any}
      />
    </div>
  );
}
