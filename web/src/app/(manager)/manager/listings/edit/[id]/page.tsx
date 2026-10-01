import { notFound } from 'next/navigation';
import { getManagerUser } from '@/app/actions/manager';
import { managerApi } from '@/lib/api/manager';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { toLegacyListingShape } from '@/lib/api/legacy-listing';
import { ManagerEditForm } from './manager-edit-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface ManagerEditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function ManagerEditListingPage({
  params,
}: ManagerEditListingPageProps) {
  const { id } = await params;
  const manager = await getManagerUser();

  if (!manager) {
    notFound();
  }

  // 404 when the listing is missing or outside the manager's campus/region.
  const apiListing = await managerApi.getListing(id).catch(() => null);
  if (!apiListing) {
    notFound();
  }

  const agent = apiListing.agent;
  // The form reads the legacy `listing_images` / `listing_room_types` keys.
  const listing = toLegacyListingShape(apiListing);
  const campusZones = await agentDashboardApi.zones(apiListing.campus_id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/manager/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manager editing &middot; {agent?.name || 'Unknown agent'}
        </p>
      </div>

      <ManagerEditForm
        agentId={agent?.id || (listing as any).agent_id || ''}
        agentWhatsapp={agent?.whatsapp || agent?.phone || ''}
        initialListing={listing as any}
        campusId={listing.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
