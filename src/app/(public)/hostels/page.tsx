import { Metadata } from 'next';
import { Suspense } from 'react';
import { supabasePublic } from '@/lib/supabase/public';
import HostelsSearch, { type Listing } from './hostels-search';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import { getCampusBySlug, isFallbackCampus } from '@/lib/data/campuses';
import { getActiveAnnouncements } from '@/lib/data/announcements';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

// Search is client-side over a single filtered snapshot; ISR keeps this
// expensive joined query from re-running on every list visit.
export const revalidate = 3600;

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
  const { data } = await supabasePublic
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
    .eq('is_active', true)
    .order('sort_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  return (data as unknown as Listing[]) || [];
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
