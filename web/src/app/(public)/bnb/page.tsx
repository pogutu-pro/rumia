import { Metadata } from 'next';
import { Suspense } from 'react';
import { bnbApi } from '@/lib/api/bnb';
import BnbSearch, { BnbSearchSkeleton, type BnbListing } from './bnb-search';

export const revalidate = 300;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

export const metadata: Metadata = {
  title: 'RumiaBnB — Short Stays in Nyeri & Across Kenya',
  description:
    'Find comfortable short-stay accommodation in Nyeri and beyond. Entire homes, private rooms and shared spaces for any kind of trip.',
  alternates: { canonical: `${baseUrl}/bnb` },
  openGraph: {
    title: 'RumiaBnB — Short Stays | Rumia',
    description:
      'Comfortable short-stay accommodation in Nyeri and beyond. Browse verified listings and contact hosts directly.',
    url: `${baseUrl}/bnb`,
    siteName: 'Rumia',
    type: 'website',
  },
};

async function getAllBnbListings(): Promise<BnbListing[]> {
  try {
    const feed = await bnbApi.getPublicFeedServer({
      limit: 500,
      is_active: true,
    });
    return feed.items.map((item: any) => ({
      id: String(item.id),
      title: item.title,
      description: item.description ?? '',
      price: item.price,
      location: item.location,
      area: item.area ?? null,
      county: item.county ?? null,
      slug: item.slug ?? null,
      amenities: item.amenities ?? null,
      property_type: item.property_type ?? null,
      verified: item.verified ?? null,
      images: item.images ?? [],
      agent: item.agent ?? null,
      bnb: item.bnb ?? null,
    }));
  } catch (error) {
    console.error('Failed to fetch BnB listings:', error);
    return [];
  }
}

export default async function BnbPage() {
  const allListings = await getAllBnbListings();

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Page header */}
      <section className="bg-white border-b border-slate-100 py-10 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-black text-slate-950 tracking-tight">
              RumiaBnB
            </h1>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
              Short stays
            </span>
          </div>
          <p className="text-slate-600 text-base leading-relaxed font-medium max-w-2xl">
            Comfortable stays in Nyeri and beyond — entire homes, private rooms
            and shared spaces for any kind of trip.
          </p>
        </div>
      </section>

      <Suspense fallback={<BnbSearchSkeleton />}>
        <BnbSearch allListings={allListings} />
      </Suspense>
    </div>
  );
}
