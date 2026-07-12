import { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import HostelsSearch, { type Listing } from './hostels-search';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

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

const PAGE_SIZE = 24;

async function getInitialListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select(
      'id, title, description, price, location, slug, county, area, gender, specific_location, price_single, price_sharing, distance_category, listing_images(r2_url, display_order, blur_data_url), agents(name)',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  return (data as unknown as Listing[]) || [];
}

async function getListingCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  return count || 0;
}

export default async function HostelsPage() {
  const [initialListings, totalCount] = await Promise.all([
    getInitialListings(),
    getListingCount(),
  ]);

  return (
    <Suspense>
      <HostelsSearch
        initialListings={initialListings}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
      />
    </Suspense>
  );
}
