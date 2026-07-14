import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { JsonLd } from '@/components/seo/json-ld';
import DeKutCompareGrid from './dekut-compare-grid';

export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';
const CANONICAL = `${BASE}/hostels/nyeri/dekut`;

export const metadata: Metadata = {
  title: 'Student Hostels Near DeKUT Nyeri — Browse Verified Rooms',
  description:
    'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms along Gichugu Road,Boma,Nyeri view,Nyaribo & Gate A. Book today.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'Student Hostels Near DeKUT Nyeri — Browse Verified Rooms | Rumia',
    description:
      'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms along Gichugu Road,Boma,Nyeri view,Nyaribo & Gate A. Book today.',
    url: CANONICAL,
    siteName: 'Rumia',
    type: 'website',
    images: [
      {
        url: '/og-dekut.png',
        width: 1200,
        height: 630,
        alt: 'Student hostels near DeKUT Nyeri',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Student Hostels Near DeKUT Nyeri — Browse Verified Rooms | Rumia',
    description:
      'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms along Gichugu Road,Boma,Nyeri view,Nyaribo & Gate A. Book today..',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Rumia',
  url: BASE,
  description: 'Verified student hostel listings near universities in Kenya.',
  areaServed: { '@type': 'City', name: 'Nyeri', addressCountry: 'KE' },
};

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Student Hostels Near DeKUT Nyeri',
  url: CANONICAL,
  description:
    'Browse verified student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya.',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', '.page-description'],
  },
};

export default async function DeKUTLandingPage() {
  const supabase = await createClient();

  const { data: listingsData } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, price, location, slug, county, area, gender, specific_location,
      price_single, price_sharing, distance_category, distance_to_campus, mpesa_details,
      amenities, room_type, room_type_enum, bathroom_type,
      wifi_included, water_included, electricity_included, security_type,
      latitude, longitude,
      listing_images ( r2_url, display_order, blur_data_url ),
      agents ( name, phone, whatsapp )
    `,
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const listings = (listingsData || []) as any[];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <JsonLd data={organizationSchema} />
      <JsonLd data={webPageSchema} />

      {/* Hero / SEO content block */}
      <section className="bg-white border-b border-slate-100 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mb-4">
            Find Your Room Near DeKUT
          </h1>
          <p className="page-description text-slate-600 text-base sm:text-lg leading-relaxed font-medium max-w-3xl">
            Rumia lists verified student hostels near{' '}
            <strong>Dedan Kimathi University of Technology (DeKUT)</strong> in
            Nyeri, Kenya. Whether you are looking for a self-contained
            bedsitter, a shared double room, or an ensuite single, you will find
            options along <strong>Gichugu Road</strong>, near{' '}
            <strong>Gate A</strong>, and throughout the surrounding Nyeri
            neighbourhoods. All listings are posted by verified agents — click
            any listing to contact them directly on WhatsApp.
          </p>

          <div className="flex flex-wrap gap-2 mt-6 text-sm font-semibold text-slate-500">
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              Self Contained
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              Single Rooms
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              Double Rooms
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              Near Gate A
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              Gichugu Road
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">Nyeri</span>
          </div>
        </div>
      </section>

      {/* Listings grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-extrabold text-slate-950">
            {listings.length} Verified Hostels Near DeKUT
          </h2>
          <Link
            href="/hostels"
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View all hostels <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {listings.length > 0 ? (
          <DeKutCompareGrid listings={listings} />
        ) : (
          <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
            <p className="text-slate-400 font-medium">
              Listings are being added. Check back soon.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
