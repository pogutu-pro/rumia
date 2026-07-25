import { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import HostelsSearch, { type Listing } from './hostels-search';
import { sortListingsByPosition } from '@/lib/utils/listing-sort';

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

async function getAllActiveListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select(
      `id, title, description, price, location, slug, county, area, gender, specific_location,
       price_single, price_sharing, distance_category, distance_to_campus, mpesa_details,
       amenities, room_type, room_type_enum, bathroom_type,
       wifi_included, water_included, electricity_included, security_type,
       latitude, longitude, proximity_description, created_at, sort_position,
       listing_images(r2_url, display_order, blur_data_url),
       agents(name, phone, whatsapp)`,
    )
    .eq('is_active', true);

  return sortListingsByPosition(data as unknown as Listing[]) || [];
}

export default async function HostelsPage() {
  const allListings = await getAllActiveListings();

  return (
    <Suspense>
      <HostelsSearch
        allListings={allListings}
      />
    </Suspense>
  );
}
