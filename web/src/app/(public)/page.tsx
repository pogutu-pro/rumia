import { Metadata } from 'next';
import { listingsApi } from '@/lib/api/listings';

import { JsonLd } from '@/components/seo/json-ld';
import { ExploreDiscovery, type ExploreZone } from '@/components/home/explore-discovery';
import { ListingSection } from '@/components/home/listing-section';
import type { ExploreListing } from '@/components/home/explore-listing-card';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import { getCampusBySlug, isFallbackCampus } from '@/lib/data/campuses';
import { getZonesByCampusSlug } from '@/lib/data/zones';
import { getActiveAnnouncements } from '@/lib/data/announcements';
import type { Campus, Listing } from '@/types';

export const revalidate = 300;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';

const FEED_LIMIT = 12;

export async function generateMetadata(): Promise<Metadata> {
  const campus = await getCampusBySlug('dekut');

  const description =
    campus.og_description ??
    'Explore verified hostels, apartments and short stays in Nyeri. Browse by category, save favourites and contact agents directly on WhatsApp.';

  return {
    title: campus.seo_title ?? 'Rumia — Explore Hostels, Apartments & Short Stays in Kenya',
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
      title: campus.og_title ?? `Find places to stay near your campus | Rumia`,
      description:
        'Explore verified hostels, apartments and short stays in Nyeri. Contact agents directly on WhatsApp.',
    },
  };
}

function buildPageSchemas(campus: Campus, listings: ExploreListing[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Rumia',
        url: baseUrl,
        description: `Verified places to stay near ${campus.name}, ${campus.city}, Kenya.`,
        areaServed: { '@type': 'City', name: campus.city, addressCountry: 'KE' },
      },
      {
        '@type': 'WebSite',
        name: 'Rumia',
        url: baseUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/hostels?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'ItemList',
        name: `Accommodation near ${campus.name}`,
        numberOfItems: Math.min(listings.length, 10),
        itemListElement: listings.slice(0, 10).map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: item.title,
          url: `${baseUrl}${item.slug ? `/hostels/${item.county || 'nyeri'}/${item.area || 'dekut'}/${item.slug}` : `/listing/${item.id}`}`,
          image: item.image_url || undefined,
        })),
      },
    ],
  };
}

function toExploreListing(item: Listing): ExploreListing {
  const firstImage = item.images?.[0];
  return {
    id: String(item.id),
    title: item.title,
    price: item.price,
    location: item.location,
    slug: item.slug,
    county: item.county,
    area: item.area,
    property_type: item.property_type,
    distance_category: item.distance_category,
    room_type: item.room_type,
    bathroom_type: item.bathroom_type,
    wifi_included: item.wifi_included,
    rating: typeof item.rating === 'number' ? item.rating : (Number(item.rating) || 0),
    views: item.views,
    created_at: item.created_at,
    image_url: firstImage?.r2_url ?? null,
    blur_data_url: firstImage?.blur_data_url ?? null,
  };
}

function dedupeById(listings: ExploreListing[]): ExploreListing[] {
  const seen = new Set<string>();
  const result: ExploreListing[] = [];
  for (const item of listings) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

async function fetchFeed(
  params: {
    limit?: number;
    sort?: 'views' | 'newest';
    property_type?: string;
    campus_slug?: string;
  },
): Promise<ExploreListing[]> {
  try {
    const feed = await listingsApi.getFeedServer({
      limit: params.limit ?? FEED_LIMIT,
      is_active: true,
      sort: params.sort,
      property_type: params.property_type,
      campus_slug: params.campus_slug,
    });
    return feed.items.map(toExploreListing);
  } catch (err) {
    console.error('Failed to fetch explore listings from backend:', err);
    return [];
  }
}

export default async function HomePage() {
  const campus = await getCampusBySlug('dekut');
  const campusSlug = isFallbackCampus(campus) ? undefined : campus.slug;
  const campusName = campus.short_name ?? campus.name;
  const city = campus.city ?? 'Nyeri';

  const [campusZones, activeAnnouncements, allFeed, apartFeed, shortStayFeed, popularFeed, newestFeed] =
    await Promise.all([
      getZonesByCampusSlug(campus.slug),
      getActiveAnnouncements(isFallbackCampus(campus) ? null : campus.id),
      fetchFeed({ limit: 24, campus_slug: campusSlug }),
      fetchFeed({ property_type: 'apartment', campus_slug: campusSlug }),
      fetchFeed({ property_type: 'short_stay', campus_slug: campusSlug }),
      fetchFeed({ sort: 'views', campus_slug: campusSlug }),
      fetchFeed({ sort: 'newest', campus_slug: campusSlug }),
    ]);

  const allPool = dedupeById([
    ...allFeed,
    ...apartFeed,
    ...shortStayFeed,
    ...popularFeed,
    ...newestFeed,
  ]);

  const exploreItems = dedupeById([
    ...allFeed,
    ...apartFeed,
    ...shortStayFeed,
  ]);

  // Derived intent sections from real database listings
  const bedsitterFeed = dedupeById(
    allPool.filter((item) => {
      const room = (item.room_type ?? '').toLowerCase();
      const title = (item.title ?? '').toLowerCase();
      return (
        room.includes('bed') ||
        room.includes('self-contained') ||
        title.includes('bedsitter') ||
        title.includes('bed-sitter') ||
        title.includes('bed sitter')
      );
    }),
  ).slice(0, FEED_LIMIT);

  const affordableFeed = dedupeById(
    allPool
      .filter((item) => (item.property_type ?? 'hostel') !== 'short_stay' && item.price > 0)
      .sort((a, b) => a.price - b.price),
  ).slice(0, FEED_LIMIT);

  const highlyRatedFeed = dedupeById(
    allPool
      .filter((item) => (item.rating ?? 0) >= 4)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
  ).slice(0, FEED_LIMIT);

  // Consolidate real accommodation zones from campus_zones and listings feed
  const areaCounts = new Map<string, number>();
  for (const item of exploreItems) {
    const areaName = (item.area || '').trim();
    if (areaName) {
      areaCounts.set(areaName, (areaCounts.get(areaName) ?? 0) + 1);
    }
  }

  const zoneMap = new Map<string, ExploreZone>();
  for (const z of campusZones) {
    if (z.name) {
      const trimmed = z.name.trim();
      zoneMap.set(trimmed.toLowerCase(), {
        name: trimmed,
        slug: z.slug,
        count: areaCounts.get(trimmed) ?? 0,
      });
    }
  }

  for (const [areaName, count] of areaCounts.entries()) {
    const key = areaName.toLowerCase();
    if (!zoneMap.has(key)) {
      zoneMap.set(key, {
        name: areaName,
        count,
      });
    }
  }

  const zones: ExploreZone[] = Array.from(zoneMap.values());

  return (
    <main id="main-content" className="flex flex-col min-h-screen bg-white">
      <h1 className="sr-only">
        Student Accommodation, Hostels, Bedsitters & Apartments near {campus.name}
      </h1>
      <JsonLd data={buildPageSchemas(campus, exploreItems)} />

      {activeAnnouncements.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-4 lg:px-8">
          <PublicAnnouncements announcements={activeAnnouncements} />
        </section>
      )}

      {/* Primary Discovery Hero: Property Types + Zone Discovery + Immediate Listing Rail */}
      <ExploreDiscovery
        city={city}
        campusName={campusName}
        zones={zones}
        items={exploreItems}
      />

      {/* Intent-Driven Discovery Sections (Auto-hidden when empty) */}
      <div className="pb-12 space-y-2">
        {/* 1. Bedsitters & Self-contained */}
        <ListingSection
          title={`Bedsitters near ${campusName}`}
          subtitle="Self-contained and single bedsitter rooms for students"
          seeAllHref="/hostels?q=bedsitter"
          seeAllLabel="See bedsitters"
          items={bedsitterFeed}
        />

        {/* 2. Popular */}
        <ListingSection
          title={`Popular near ${campusName}`}
          subtitle="Most-viewed places on Rumia"
          seeAllHref="/hostels"
          seeAllLabel="See all popular"
          items={popularFeed}
        />

        {/* 3. Affordable */}
        <ListingSection
          title="Affordable student stays"
          subtitle="Budget-friendly rooms and hostels"
          seeAllHref="/hostels?maxPrice=6500"
          seeAllLabel="See budget stays"
          items={affordableFeed}
        />

        {/* 4. Highly Rated (shown only if ratings exist in data) */}
        <ListingSection
          title="Highly rated"
          subtitle="Top-rated accommodation reviewed by students"
          seeAllHref="/hostels"
          seeAllLabel="See top rated"
          items={highlyRatedFeed}
        />

        {/* 5. New Listings */}
        <ListingSection
          title="New on Rumia"
          subtitle="Fresh listings recently added"
          seeAllHref="/hostels"
          seeAllLabel="See new listings"
          items={newestFeed}
        />

        {/* 6. Apartments */}
        <ListingSection
          title={`Apartments in ${city}`}
          subtitle="Self-contained units for monthly stays"
          seeAllHref="/hostels?type=apartment"
          seeAllLabel="See apartments"
          items={apartFeed}
        />

        {/* 7. Short Stays */}
        <ListingSection
          title={`Short stays in ${city}`}
          subtitle="Nightly-priced stays for short visits"
          seeAllHref="/hostels?type=short_stay"
          seeAllLabel="See short stays"
          items={shortStayFeed}
        />
      </div>
    </main>
  );
}