import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { listingsApi } from '@/lib/api/listings';
import { toLegacyListingShape } from '@/lib/api/legacy-listing';
import { notFound, redirect } from 'next/navigation';
import { NewListingForm } from '../../new/new-listing-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({
  params,
}: EditListingPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) {
    redirect('/dashboard');
  }

  if (agent.status === 'suspended') {
    redirect('/dashboard');
  }

  // Owner read: includes inactive listings (and 404s for listings that aren't theirs or missing).
  const apiListing = await listingsApi.getByIdAuthenticatedServer(id).catch(() => null);
  if (!apiListing || apiListing.agent?.id !== agent.id) {
    notFound();
  }
  // The form reads the legacy `listing_images` / `listing_room_types` keys.
  const listing = toLegacyListingShape(apiListing);

  const campusZones = await agentDashboardApi.zones(agent.campus_id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Edit Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Update address, room details, photos, and publishing status.
        </p>
      </div>

      <NewListingForm
        agentId={agent.id}
        agentWhatsapp={agent.whatsapp || agent.phone || ''}
        initialListing={listing as any}
        mode="edit"
        campusId={agent.campus_id || null}
        campusZones={campusZones || []}
      />
    </div>
  );
}
