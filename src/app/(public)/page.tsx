import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin } from 'lucide-react';
import { Metadata } from 'next';
import { Input } from '@/components/ui/input';
import { supabasePublic } from '@/lib/supabase/public';
import { EarlyAccessBanner } from '@/components/feedback/early-access-banner';
import { JsonLd } from '@/components/seo/json-ld';
import { CampusPickerCards } from '@/components/home/campus-picker-cards';
import { FindMeAHostel } from '@/app/account/find-me-a-hostel';
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

  let locQuery = supabasePublic
    .from('listings')
    .select('location')
    .eq('is_active', true);
  if (!isFallbackCampus(campus)) {
    locQuery = locQuery.eq('campus_id', campus.id);
  }
  const { data: locsData } = await locQuery;

  let uniqueLocations: string[];
  if (locsData && locsData.length > 0) {
    uniqueLocations = (
      Array.from(
        new Set(locsData.map((l: any) => l.location.split(',')[0].trim())),
      ) as string[]
    ).slice(0, 4);
  } else {
    uniqueLocations = [];
  }

  const { count: totalActiveListings } = await supabasePublic
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const heroImage = campus.hero_image ?? '/dekut.jpeg';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <JsonLd data={buildOrganizationSchema(campus)} />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-slate-950 text-white">
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-md">
            <span>Verified Student Accommodations</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-4">
            Find Verified Hostels Near Your Campus
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            Browse verified student rooms near the Dedan Kimathi University of Technology campus in Nyeri. Contact agents directly on WhatsApp with zero booking fees.
          </p>

          {/* Search Bar Widget */}
          <div className="bg-white p-2 sm:p-3 rounded-2xl shadow-2xl border border-slate-100 max-w-3xl mx-auto text-slate-800">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Link href="/hostels" className="relative flex-1 w-full">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  type="text"
                  defaultValue=""
                  readOnly
                  placeholder='Search hostels — try "self contained Gate A"'
                  className="w-full pl-12 pr-4 h-12 border-0 focus-visible:ring-0 text-base font-medium placeholder-slate-400 cursor-pointer"
                />
              </Link>
              <Link
                href="/hostels"
                className="w-full sm:w-auto h-12 px-8 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-md shadow-emerald-600/10 text-sm shrink-0"
              >
                <Search className="h-4 w-4" />
                Search Hostels
              </Link>
            </div>
          </div>

          {/* Quick Locations */}
          {uniqueLocations.length > 0 && (
            <div className="mt-8 flex items-center justify-center flex-wrap gap-2 text-sm text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">Popular:</span>
              {uniqueLocations.map((loc) => (
                <Link
                  key={loc}
                  href={`/hostels?q=${encodeURIComponent(loc)}`}
                  className="px-3.5 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all font-medium"
                >
                  {loc}
                </Link>
              ))}
            </div>
          )}
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

      {/* Find Me a Hostel — replaces Popular Hostels on the homepage */}
      <FindMeAHostel
        variant="home"
        campusId={isFallbackCampus(campus) ? null : campus.id}
        campusName={campus.name}
        studentPhone={null}
      />

      {/* Early Access Banner */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <EarlyAccessBanner hostelCount={totalActiveListings ?? 0} />
      </section>
    </div>
  );
}
