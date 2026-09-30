import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { bnbApi } from '@/lib/api/bnb';
import { BnbListingForm, type BnbInitialData } from '../../new/bnb-listing-form';

export const revalidate = 0;

export default async function EditBnbListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('id, status, whatsapp')
    .eq('user_id', user.id)
    .maybeSingle();

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
    is_active: listing.is_active,
    images: listing.images ?? [],
    bnb: listing.bnb ?? undefined,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/bnb"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to RumiaBnB
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit BnB listing</h1>
        <p className="text-sm text-slate-500 mt-1 truncate">{listing.title}</p>
      </div>

      <BnbListingForm mode="edit" initialData={initialData} agentWhatsapp={agent.whatsapp} />
    </div>
  );
}
