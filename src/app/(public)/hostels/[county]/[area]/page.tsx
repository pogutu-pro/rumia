import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@/lib/supabase/public';
import { JsonLd } from '@/components/seo/json-ld';
import { getAllCampusesStatic, isFallbackCampus } from '@/lib/data/campuses';
import { resolveCampusFromSegments } from '@/lib/data/campus-route';
import { getActiveAnnouncements } from '@/lib/data/announcements';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import HostelsSearch, { type Listing } from '../../hostels-search';
import type { Campus } from '@/types';

export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

interface PageProps {
  params: Promise<{ county: string; area: string }>;
}

// Generic chips shown on every campus landing; campus-specific zones come from
// feature_flags.landing_chips (config-driven, no component registry).
const GENERIC_CHIPS = ['Self Contained', 'Single Rooms', 'Double Rooms'];

function flagString(campus: Campus, key: string): string | null {
  const value = campus.feature_flags?.[key];
  return typeof value === 'string' ? value : null;
}

function flagStrings(campus: Campus, key: string): string[] {
  const value = campus.feature_flags?.[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export async function generateStaticParams() {
  const campuses = await getAllCampusesStatic();
  return campuses
    .filter((c) => c.status === 'active')
    .map((c) => ({ county: c.city.toLowerCase(), area: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { county, area } = await params;
  const campus = await resolveCampusFromSegments(county, area);
  if (!campus) return { title: 'Hostels Not Found' };

  const shortName = campus.short_name ?? campus.name;
  const canonical = `${BASE}/hostels/${county}/${area}`;
  const title = `Student Hostels Near ${shortName} ${campus.city} — Browse Verified Rooms`;
  const description =
    flagString(campus, 'landing_seo_description') ??
    `Find verified student hostels near ${campus.name} in ${campus.city}. Self-contained, single, and shared rooms. Book today.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Rumia`,
      description,
      url: canonical,
      siteName: 'Rumia',
      type: 'website',
      images: [{ url: '/og-default.png', width: 1200, height: 630, alt: `Student hostels near ${shortName} ${campus.city}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Rumia`,
      description,
    },
  };
}

function buildSchemas(campus: Campus, canonical: string) {
  const shortName = campus.short_name ?? campus.name;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Rumia',
      url: BASE,
      description: 'Verified student hostel listings near universities in Kenya.',
      areaServed: { '@type': 'City', name: campus.city, addressCountry: 'KE' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Student Hostels Near ${shortName} ${campus.city}`,
      url: canonical,
      description: `Browse verified student hostels near ${campus.name} in ${campus.city}, Kenya.`,
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.page-description'],
      },
    },
  ];
}

export default async function CampusLandingPage({ params }: PageProps) {
  const { county, area } = await params;
  const campus = await resolveCampusFromSegments(county, area);
  if (!campus) notFound();

  const supabase = supabasePublic;

  let query = supabase
    .from('listings')
    .select(
      `
      id, title, description, price, location, slug, county, area, gender, specific_location,
      price_single, price_sharing, distance_category, distance_to_campus, mpesa_details,
      amenities, room_type, room_type_enum, bathroom_type,
      wifi_included, water_included, electricity_included, security_type,
      latitude, longitude, created_at, sort_position,
      listing_images ( r2_url, display_order, blur_data_url ),
      listing_room_types ( deposit, furnishing_items, room_type ),
      agents ( name, phone, whatsapp )
    `,
    )
    .eq('is_active', true);

  if (campus.id && campus.id !== 'dekut') {
    query = query.eq('campus_id', campus.id);
  } else if (campus.slug) {
    query = query.eq('area', campus.slug);
  }

  query = query
    .order('sort_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: listingsData } = await query;

  const activeAnnouncements = await getActiveAnnouncements(
    isFallbackCampus(campus) ? null : campus.id,
  );

  const listings = (listingsData || []).map((item: any) => ({
    ...item,
    agents: Array.isArray(item.agents) ? item.agents[0] ?? null : item.agents,
  })) as Listing[];

  const shortName = campus.short_name ?? campus.name;
  const chips = [...GENERIC_CHIPS, ...flagStrings(campus, 'landing_chips')];
  const canonical = `${BASE}/hostels/${county}/${area}`;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {buildSchemas(campus, canonical).map((schema, i) => (
        <JsonLd key={i} data={schema} />
      ))}

      {/* Hero / SEO content block */}
      <section className="bg-white border-b border-slate-100 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mb-4">
            Find Your Room Near {shortName}
          </h1>
          <p className="page-description text-slate-600 text-base sm:text-lg leading-relaxed font-medium max-w-3xl">
            Find verified student hostels near{' '}
            <strong>
              {campus.name} ({shortName})
            </strong>{' '}
            in {campus.city}, Kenya. Self-contained, single, and shared rooms
            for students, all listed by verified agents.
          </p>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 text-sm font-semibold text-slate-500">
              {chips.map((chip) => (
                <span key={chip} className="bg-slate-100 px-3 py-1 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <section className="bg-slate-50/50 pt-6 lg:pt-10">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <PublicAnnouncements announcements={activeAnnouncements} />
          </div>
        </section>
      )}

      {/* Search, filters & listings — reused from /hostels */}
      <Suspense>
        <HostelsSearch
          allListings={listings}
          hideHeader
          basePath={`/hostels/${county}/${area}`}
        />
      </Suspense>
    </div>
  );
}
