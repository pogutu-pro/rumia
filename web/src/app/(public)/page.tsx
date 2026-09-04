import Image from 'next/image';
import { Metadata } from 'next';
import { listingsApi } from '@/lib/api/listings';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';

import { JsonLd } from '@/components/seo/json-ld';
import { CampusPickerCards } from '@/components/home/campus-picker-cards';
import { PopularHostels } from '@/components/home/popular-hostels';
import { FindMeAHostel } from '@/app/account/find-me-a-hostel';
import { HOSTEL_REQUEST_FEE } from '@/lib/constants/hostel-requests';
import { getCampusBySlug, getAllCampuses, isFallbackCampus } from '@/lib/data/campuses';
import { getActiveAnnouncements } from '@/lib/data/announcements';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import type { Campus } from '@/types';

export const revalidate = 86400;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

export async function generateMetadata(): Promise<Metadata> {
  const campus = await getCampusBySlug('dekut');

  const description =
    campus.og_description ??
    'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms. Contact agents directly on WhatsApp.';

  return {
    title: campus.seo_title ?? 'Rumia — Verified Student Hostels Near Universities in Kenya',
    description,
    alternates: { canonical: baseUrl },
    openGraph: {
      title: campus.og_title ?? `${campus.seo_title} | Rumia`,
      description,
      url: baseUrl,
      siteName: 'Rumia',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: campus.og_title ?? `${campus.seo_title} | Rumia`,
      description:
        campus.twitter_description ??
        'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms.',
    },
  };
}

function buildOrganizationSchema(campus: Campus) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Rumia',
    url: baseUrl,
    description: `Verified student hostel listings near ${campus.name}, ${campus.city}, Kenya.`,
    areaServed: { '@type': 'City', name: campus.city, addressCountry: 'KE' },
  };
}

export default async function HomePage() {
  const [campus, campuses] = await Promise.all([
    getCampusBySlug('dekut'),
    getAllCampuses(),
  ]);

  const activeAnnouncements = await getActiveAnnouncements(
    isFallbackCampus(campus) ? null : campus.id,
  );

  // Fetch top 10 listings + total count from FastAPI (with graceful fallback if backend is starting up)
  let feed: { items: any[]; total: number; page: number; limit: number } = { items: [], total: 0, page: 1, limit: 10 };
  try {
    feed = await listingsApi.getFeedServer({
      campus_slug: isFallbackCampus(campus) ? undefined : campus.slug,
      limit: 10,
      is_active: true,
      sort: 'views',
    });
  } catch (err) {
    console.error('Failed to fetch listings feed from FastAPI backend:', err);
  }

  const popularListings = feed.items.map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price,
    location: item.location,
    slug: item.slug,
    county: item.county,
    area: item.area,
    view_count: item.views,
    agent_name: item.agent?.name || null,
    r2_url: item.images?.[0]?.r2_url || null,
    blur_data_url: item.images?.[0]?.blur_data_url || null,
  }));

  const totalActiveListings = feed.total;


  const heroImage = campus.hero_image ?? '/dekut.jpeg';

  const campusFee = campus.hostel_finding_fee ?? HOSTEL_REQUEST_FEE;

  return (

    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <JsonLd data={buildOrganizationSchema(campus)} />

      {/* Hero Section */}
      <section className="relative pt-20 lg:pt-32 pb-24 lg:pb-32 overflow-hidden bg-slate-950 text-white">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={75}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />

        <div className="container relative z-10 mx-auto px-4 text-center max-w-4xl">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-4">
            Find Verified Hostels Near Your Campus
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-4 font-medium leading-relaxed">
            Browse verified student rooms near the Dedan Kimathi University of Technology campus in Nyeri. Contact agents directly on WhatsApp with zero booking fees.
          </p>
        </div>
      </section>

      {/* Announcements — only rendered when there are active ones */}
      {activeAnnouncements.length > 0 && (
        <section className="container mx-auto px-4 pt-6 sm:pt-8 pb-8">
          <PublicAnnouncements announcements={activeAnnouncements} />
        </section>
      )}

      {/* University Campus Picker Cards Section */}
      <CampusPickerCards campuses={campuses} />

      {/* Popular Hostels — top 10 most-visited listings */}
      <PopularHostels listings={popularListings ?? []} />

      {/* Find Me a Hostel */}
      <FindMeAHostel
        variant="home"
        campusId={isFallbackCampus(campus) ? null : campus.id}
        campusName={campus.name}
        studentPhone={null}
        campusFee={campusFee}
      />

      {/* Early Access Banner */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <EarlyAccessBanner hostelCount={totalActiveListings ?? 0} />
      </section>
    </div>
  );
}
