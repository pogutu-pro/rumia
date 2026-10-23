import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect, notFound } from 'next/navigation';
import { bnbApi } from '@/lib/api/bnb';
import { BnbListingForm, type BnbInitialData } from '../../new/bnb-listing-form';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export const revalidate = 0;

export default async function EditBnbListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent || agent.status === 'suspended') redirect('/dashboard');

  let listing: any;
  try {
    listing = await bnbApi.getForEditServer(id);
  } catch {
    notFound();
  }

  // Ownership check — agent must own this listing
  if (listing.agent_id !== agent.id) redirect('/dashboard/bnb');

  const initialData: BnbInitialData = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    location: listing.location,
    county: listing.county,
    area: listing.area,
    specific_location: listing.specific_location,
    latitude: listing.latitude,
    longitude: listing.longitude,
    amenities: listing.amenities ?? [],
    youtube_id: listing.youtube_id,
    is_youtube_shorts: listing.is_youtube_shorts,
    is_active: listing.is_active,
    images: listing.images ?? [],
    bnb: listing.bnb ?? undefined,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader
        back={{ href: '/dashboard/bnb', label: 'RumiaBnB' }}
        title="Edit short stay"
        description={<span className="block truncate">{listing.title}</span>}
      />

      <BnbListingForm mode="edit" initialData={initialData} agentWhatsapp={agent.whatsapp} />
    </div>
  );
}
