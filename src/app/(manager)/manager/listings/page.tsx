import { getManagerListingsAction, getManagerUser } from '@/app/actions/manager';
import { ManagerListingsClient, type ManagerListingRow } from './manager-listings-client';

export default async function ManagerListingsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const listingsRaw = await getManagerListingsAction();

  const listings: ManagerListingRow[] = (listingsRaw ?? []).map((listing: any) => {
    const images: Array<{ r2_url: string; display_order: number }> =
      listing.listing_images ?? [];
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const coverImage: string | null = sorted[0]?.r2_url ?? null;

    return {
      id: listing.id,
      slug: listing.slug ?? null,
      title: listing.title,
      location: listing.location,
      area: listing.area ?? null,
      price: listing.price,
      is_active: listing.is_active,
      created_at: listing.created_at,
      agent_name: Array.isArray(listing.agents)
        ? listing.agents[0]?.name ?? '—'
        : listing.agents?.name ?? '—',
      leads_count: listing.leads?.length ?? 0,
      cover_image: coverImage,
      landlord_phone: listing.landlord_phone ?? null,
    };
  });

  return <ManagerListingsClient listings={listings} />;
}
