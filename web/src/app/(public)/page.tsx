import { getLiveMarkets, joinNames } from '@/lib/seo/markets';
import { listingPath } from '@/lib/utils/listing-path';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { listingsApi } from '@/lib/api/listings';

import { JsonLd } from '@/components/seo/json-ld';
import {
  ExploreDiscovery,
  type ExploreZone,
} from '@/components/home/explore-discovery';
import { ForYou } from '@/components/home/for-you';
import { HomeHeading } from '@/components/home/home-heading';
import { ListingSection } from '@/components/home/listing-section';
import type { ExploreListing } from '@/components/home/explore-listing-card';
import { PublicAnnouncements } from '@/components/announcements/public-announcements';
import { getDefaultCampus, isFallbackCampus } from '@/lib/data/campuses';
import { getZonesByCampusSlug } from '@/lib/data/zones';
import { getActiveAnnouncements } from '@/lib/data/announcements';
import type { Campus, Listing } from '@/types';
import { getStartingPrice } from '@/lib/utils/starting-price';
import { formatAreaName, normaliseArea } from '@/lib/utils/area-label';
import { BNB_SEPARATE } from '@/lib/site/separation';

export const revalidate = 300;

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

const FEED_LIMIT = 12;

export async function generateMetadata(): Promise<Metadata> {
  // The tab title no longer comes from the campus row: the home page is for every kind of place, not only student housing.
  const title = BNB_SEPARATE ? 'Rumia: Hostels, Bedsitters & Apartments' : 'Rumia: Short Stays, Hostels & Apartments';
  const places = joinNames((await getLiveMarkets()).map((m) => m.name));
  const kinds = BNB_SEPARATE ? 'student hostels, bedsitters and apartments' : 'short stays, student hostels and apartments';
  const description = `Find ${kinds} to rent${places ? ` in ${places}` : ''}. Real prices, move-in costs and places confirmed by their owners, with direct contact on WhatsApp.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: baseUrl },
    openGraph: { title, description, url: baseUrl, siteName: 'Rumia', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function buildPageSchemas(
  campus: Campus,
  listings: ExploreListing[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Rumia',
        url: baseUrl,
        description: `Verified places to stay near ${campus.name}, ${campus.city}, Kenya.`,
        areaServed: {
          '@type': 'City',
          name: campus.city,
          addressCountry: 'KE',
        },
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
          url: `${baseUrl}${item.slug ? `${listingPath(item)}` : `/listing/${item.id}`}`,
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
    price: getStartingPrice(item, item.room_types),
    location: item.location,
    slug: item.slug,
    county: item.county,
    area: item.area,
    property_type: item.property_type,
    distance_category: item.distance_category,
    room_type: item.room_type,
    bathroom_type: item.bathroom_type,
    wifi_included: item.wifi_included,
    rating:
      typeof item.rating === 'number' ? item.rating : Number(item.rating) || 0,
    review_count: typeof item.review_count === 'number' ? item.review_count : null,
    views: item.views,
    created_at: item.created_at,
    image_url: firstImage?.r2_url ?? null,
    blur_data_url: firstImage?.blur_data_url ?? null,
    verified: item.verified ?? null,
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

async function fetchFeed(params: {
  limit?: number;
  sort?: 'views' | 'newest';
  property_type?: string;
  campus_slug?: string;
}): Promise<ExploreListing[]> {
  // Short stays have their own product (RumiaBnB) once separated: none on Rumia's home page.
  if (BNB_SEPARATE && params.property_type === 'short_stay') return [];
  try {
    const feed = await listingsApi.getFeedServer({
      limit: params.limit ?? FEED_LIMIT,
      is_active: true,
      sort: params.sort,
      property_type: params.property_type,
      campus_slug: params.campus_slug,
    });
    const items = feed.items.map(toExploreListing);
    return BNB_SEPARATE ? items.filter((i) => (i.property_type ?? 'hostel') !== 'short_stay') : items;
  } catch (err) {
    console.error('Failed to fetch explore listings from backend:', err);
    return [];
  }
}

export default async function HomePage() {
  const campus = await getDefaultCampus();
  const campusSlug = isFallbackCampus(campus) ? undefined : campus.slug;
  const city = campus.city ?? 'Nyeri';

  const [
    campusZones,
    activeAnnouncements,
    allFeed,
    apartFeed,
    shortStayFeed,
    popularFeed,
    newestFeed,
  ] = await Promise.all([
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

  const exploreItems = dedupeById([...allFeed, ...apartFeed, ...shortStayFeed]);

  const excludeIds = (source: ExploreListing[], exclude: Set<string>) =>
    source.filter((item) => !exclude.has(item.id));

  const popularUnique = dedupeById(popularFeed).slice(0, FEED_LIMIT);
  const popularIds = new Set(popularUnique.map((i) => i.id));

  const newestUnique = dedupeById(excludeIds(newestFeed, popularIds)).slice(
    0,
    FEED_LIMIT,
  );
  const newestIds = new Set(newestUnique.map((i) => i.id));

  const affordablePool = allPool
    .filter(
      (item) =>
        (item.property_type ?? 'hostel') !== 'short_stay' && item.price > 0,
    )
    .sort((a, b) => a.price - b.price);
  const affordableUnique = dedupeById(
    excludeIds(affordablePool, new Set([...popularIds, ...newestIds])),
  ).slice(0, FEED_LIMIT);

  // Consolidate real accommodation zones from campus_zones and the listings feed. Areas arrive both as
  // names ("Embassy Area") and slugs ("embassy-area"); they are one zone.
  const areaCounts = new Map<string, number>();
  for (const item of exploreItems) {
    const key = normaliseArea(item.area);
    if (key) areaCounts.set(key, (areaCounts.get(key) ?? 0) + 1);
  }

  const zoneMap = new Map<string, ExploreZone>();
  for (const z of campusZones) {
    if (!z.name) continue;
    const key = normaliseArea(z.name);
    zoneMap.set(key, {
      name: formatAreaName(z.name),
      slug: z.slug,
      count: areaCounts.get(key) ?? 0,
    });
  }
  for (const [key, count] of areaCounts.entries()) {
    if (!zoneMap.has(key)) zoneMap.set(key, { name: formatAreaName(key), count });
  }

  const zones: ExploreZone[] = Array.from(zoneMap.values());

  const stayItems = dedupeById([...apartFeed, ...shortStayFeed]).slice(0, FEED_LIMIT);
  const shortName =
    campus.short_name ?? campus.name;

  return (
    <div id="main-content" className="flex flex-col pb-10">
      <HomeHeading campusName={campus.name} />
      <JsonLd data={buildPageSchemas(campus, exploreItems)} />

      {activeAnnouncements.length > 0 && (
        <section className="w-full px-4 pt-4 lg:px-8">
          <PublicAnnouncements announcements={activeAnnouncements} />
        </section>
      )}

      <ExploreDiscovery
        city={city}
        campus={campus}
        zones={zones}
        items={exploreItems}
      />

      <ForYou />

      <ListingSection
        title={`Popular near ${shortName}`}
        subtitle="Most viewed on Rumia"
        seeAllHref="/hostels"
        items={popularUnique}
      />
      <ListingSection
        title="New on Rumia"
        subtitle="Recently added"
        seeAllHref="/hostels"
        items={newestUnique}
      />
      <ListingSection
        title={`Affordable near ${shortName}`}
        subtitle="Lowest monthly prices"
        seeAllHref="/hostels?maxPrice=6500"
        items={affordableUnique}
      />
      <ListingSection
        title={BNB_SEPARATE ? 'Apartments' : 'Apartments & short stays'}
        subtitle={BNB_SEPARATE ? 'Whole homes to rent by the month' : 'Other ways to stay'}
        seeAllHref="/hostels?type=apartment"
        items={stayItems}
      />

      <section className="px-4 pt-8 lg:px-8" aria-labelledby="verify-card-heading">
        <Link
          href="/verify"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-raised p-4 transition-colors active:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span id="verify-card-heading" className="block text-base font-semibold text-ink">
              Check before you pay
            </span>
            <span className="block text-sm text-ink-muted">Verify an agent or hostel, or report a problem.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
