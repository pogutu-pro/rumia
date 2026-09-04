import { Metadata } from 'next';
import { Suspense } from 'react';
import { listingsApi } from '@/lib/api/listings';
import HostelsSearch, { type Listing } from './hostels-search';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import { getCampusBySlug, isFallbackCampus } from '@/lib/data/campuses';
import { getActiveAnnouncements } from '@/lib/data/announcements';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumiamanage.com';

// Search is client-side over a single filtered snapshot; ISR keeps this
// expensive joined query from re-running on every list visit. If a build-time
// prerender ever fails to reach the API, 300s lets the page self-heal quickly
// instead of caching an empty snapshot for a full day.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Student Hostels Near DeKUT Nyeri — Search & Filter',
  description:
    'Search verified student hostels near Dedan Kimathi University of Technology in Nyeri. Filter by price, gender, room type, and amenities in real time.',
  alternates: { canonical: `${baseUrl}/hostels` },
  openGraph: {
    title: 'Student Hostels Near DeKUT Nyeri | Rumia',
    description:
      'Search verified student hostels near DeKUT in Nyeri. Filter by price, gender, room type, and amenities instantly.',
    url: `${baseUrl}/hostels`,
    siteName: 'Rumia',
    type: 'website',
  },
};

async function getAllActiveListings(): Promise<Listing[]> {
  try {
    const feed = await listingsApi.getFeedServer({
      limit: 1000,
      is_active: true,
    });
    
    // Map FastAPI response keys to the legacy Supabase keys expected by HostelsSearch
    return feed.items.map((item: any) => ({
      ...item,
      listing_images: item.images,
      agents: item.agent,
    })) as unknown as Listing[];
  } catch (error) {
    console.error('Failed to fetch active listings:', error);
    return [];
  }
}

export default async function HostelsPage() {
  const campus = await getCampusBySlug('dekut');

  const [allListings, activeAnnouncements] = await Promise.all([
    getAllActiveListings(),
    getActiveAnnouncements(isFallbackCampus(campus) ? null : campus.id),
  ]);

  return (
    <Suspense>
      {activeAnnouncements.length > 0 && (
        <div className="bg-slate-50/50 pt-6 lg:pt-10">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <PublicAnnouncements announcements={activeAnnouncements} />
          </div>
        </div>
      )}
      <HostelsSearch
        allListings={allListings}
      />
    </Suspense>
  );
}

