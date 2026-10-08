import { cache } from 'react';
import { getStartingPrice, pickBestRoomType } from '@/lib/utils/starting-price';
import { listingsApi } from '@/lib/api/listings';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  ArrowLeft,
  ArrowRight,
  Eye,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import { ImageGallery } from '@/app/(public)/listing/[id]/image-gallery';
import { ContactButton } from '@/app/(public)/listing/[id]/contact-button';
import { BookTourButton } from '@/app/(public)/listing/[id]/book-tour-button';
import { QuickFacts } from '@/app/(public)/listing/[id]/quick-facts';
import { AmenitiesGrid } from '@/app/(public)/listing/[id]/amenities-grid';
import { LocationSection } from '@/app/(public)/listing/[id]/location-section';
import { RoomTypes } from '@/app/(public)/listing/[id]/room-types';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';
import { LazyYouTube } from '@/components/seo/lazy-youtube';
import { JsonLd } from '@/components/seo/json-ld';
import { ListingViewTracker } from './listing-view-tracker';
import { IncludedUtilities } from './included-utilities';
import { ListingDescription } from './listing-description';
import { ReviewsSection } from '@/components/reviews/reviews-section';
import { readCampusConsultationFee } from '@/lib/utils/consultation-fee';
import { getZoneTourPrice } from '@/lib/utils/zone-tour-price';
import {
  ListingViewCountsAllTime,
  ListingViewCountsLine,
} from './listing-view-counts';
import { getListingViewCounts } from '@/lib/listing-views';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';
import { resolveCampusFromSegments } from '@/lib/data/campus-route';
import { getCampusById, isFallbackCampus } from '@/lib/data/campuses';
import type { Campus } from '@/types';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ county: string; area: string; slug: string }>;
}

export async function generateStaticParams() {
  try {
    const feed = await listingsApi.getFeedServer({ limit: 1000, is_active: true });
    return (feed.items || []).filter(l => l.slug).map((l: any) => ({
      county: l.county || 'nyeri',
      area: l.area || 'dekut',
      slug: l.slug,
    }));
  } catch (error) {
    return [];
  }
}

const getListing = cache(async (slug: string) => {
  try {
    const listing = await listingsApi.getByIdServer(slug);
    if (!listing || !listing.is_active) return null;

    // Fetch the full campus object for the frontend to use
    let campusesData = null;
    if (listing.campus_id) {
      campusesData = await getCampusById(listing.campus_id);
    }

    return {
      ...listing,
      listing_images: listing.images,
      agents: listing.agent,
      listing_room_types: listing.room_types,
      campuses: campusesData,
    } as any;
  } catch (error) {
    return null;
  }
});

async function getNearbyListings(listing: any) {
  try {
    const feed = await listingsApi.getFeedServer({
      county: listing.county || 'nyeri',
      area: listing.area || 'dekut',
      is_active: true,
      limit: 5,
    });
    
    return feed.items
      .filter((l: any) => l.id !== listing.id)
      .slice(0, 4)
      .map((l: any) => ({
        ...l,
        listing_images: l.images,
        agents: l.agent,
      }));
  } catch (error) {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { county, area, slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: 'Hostel Not Found' };

  const roomType =
    listing.listing_room_types?.[0]?.room_type ??
    listing.room_type ??
    'Self Contained';
  const title = `${listing.title} — ${roomType} Near DeKUT`;
  const description =
    `${listing.title} offers ${roomType.toLowerCase()} rooms from KES ${listing.price.toLocaleString()}/month near Dedan Kimathi University in Nyeri. ${listing.distance_to_campus ? `${listing.distance_to_campus} from campus. ` : ''}Contact agent on WhatsApp today.`.slice(
      0,
      155,
    );
  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
  const canonicalUrl = `${metadataBase}/hostels/${county}/${area}/${slug}`;
  const firstImage = listing.listing_images?.[0]?.r2_url;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Rumia',
      type: 'website',
      ...(firstImage ? { images: [{ url: firstImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function ListingSlugPage({ params }: PageProps) {
  const { county, area, slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  const embeddedCampus = Array.isArray(listing.campuses)
    ? listing.campuses[0]
    : listing.campuses;
  const zoneTourPrice = await getZoneTourPrice(
    listing.area,
    embeddedCampus?.id || null,
  );

  const initialViewCounts = await getListingViewCounts(listing.id);

  const images = (listing.listing_images || []).sort(
    (a: any, b: any) => a.display_order - b.display_order,
  );
  const metadataBase = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
  const canonicalUrl = `${metadataBase}/hostels/${county}/${area}/${slug}`;
  const agentSlug = listing.agents?.slug;
  const nearbyListings = await getNearbyListings(listing);

  // ── Best price computation ──────────────────────────────────────────────
  // Always prefer the cheapest shared-occupancy variant as the "Starting from" price.
  // Fall back to the cheapest overall variant. Final fallback: listing-level price.
  const roomTypes = (listing.listing_room_types || []) as any[];
  const availableRooms = roomTypes.filter((rt) => rt.is_available !== false);

  const bestVariant = pickBestRoomType(roomTypes);
  const startingPrice = getStartingPrice(listing, roomTypes);
  const startingDeposit = bestVariant?.deposit != null && bestVariant.deposit > 0
    ? bestVariant.deposit
    : null;
  const moveInFrom = startingDeposit != null ? startingPrice + startingDeposit : null;
  const isListingFull = Boolean(
    listing.is_full ||
      (roomTypes.length > 0 && availableRooms.length === 0),
  );

  const shareText = [
    `${bestVariant?.room_type || listing.room_type || 'Student hostel'} from KES ${startingPrice.toLocaleString()}/month`,
    listing.distance_to_campus
      ? `${listing.distance_to_campus} from DeKUT`
      : null,
    listing.location,
  ]
    .filter(Boolean)
    .join(' · ');

  const hasCoordinates =
    listing.latitude !== null &&
    listing.longitude !== null &&
    Number.isFinite(Number(listing.latitude)) &&
    Number.isFinite(Number(listing.longitude));

  const accommodationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    name: listing.title,
    description: listing.description,
    url: canonicalUrl,
    image: images.map((img: any) => img.r2_url),
    address: {
      '@type': 'PostalAddress',
      streetAddress: listing.location,
      addressLocality: 'Nyeri',
      addressRegion: 'Nyeri County',
      addressCountry: 'KE',
    },
    ...(listing.latitude && listing.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: listing.latitude,
            longitude: listing.longitude,
          },
        }
      : {}),
    priceRange: `KES ${startingPrice.toLocaleString()} per month`,
    provider: listing.agents
      ? {
          '@type': 'Person',
          name: listing.agents.name,
          url: agentSlug
            ? `${metadataBase}/agents/${agentSlug}`
            : undefined,
        }
      : undefined,
  };

  return (
    <div className="relative min-h-screen bg-white pb-24 md:pb-16 font-sans">
      <JsonLd data={accommodationSchema} />
      <ListingViewTracker
        listingId={listing.id}
        title={listing.title}
        price={startingPrice}
        location={listing.location}
        slug={listing.slug}
        county={listing.county || county}
        area={listing.area || area}
        imageUrl={images[0]?.r2_url}
      />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 pt-4 md:hidden">
        <Link
          href="/hostels"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950"
          aria-label="Back to hostels"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
          <div className="pointer-events-auto flex items-center gap-2">
            <ListingViewCountsAllTime
              listingId={listing.id}
              initialCounts={initialViewCounts}
              className="text-xs font-bold text-slate-500"
              iconSize={3}
            />
            <SaveButton listingId={listing.id} variant="icon" />
          <ShareListingButton
            variant="icon"
            listing={{
              name: listing.title,
              area: listing.area,
              url: canonicalUrl,
              imageUrl: images[0]?.r2_url,
            }}
            className="h-11 w-11 rounded-full border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm hover:bg-white hover:text-slate-950"
          />
        </div>
      </div>

      {/* Top Bar */}
      <div className="border-b border-slate-100 bg-white sticky top-0 z-30 hidden md:block">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/hostels"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to hostels
          </Link>
          <div className="flex items-center gap-4">
            <ListingViewCountsAllTime
              listingId={listing.id}
              initialCounts={initialViewCounts}
              className="text-sm font-bold text-slate-500 gap-1.5"
              iconSize={4}
            />
            <ShareListingButton
              listing={{
                name: listing.title,
                area: listing.area,
                url: canonicalUrl,
                imageUrl: images[0]?.r2_url,
              }}
              className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            />
            <SaveButton listingId={listing.id} />
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="md:container md:mx-auto md:px-4 lg:px-8 md:pt-6">
        <ImageGallery images={images} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                {listing.title}
              </h1>

              {/* Area, Specific Location, and Distance Badge - directly below title */}
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                <span>{listing.area || 'Hostel Area'}</span>
                {listing.specific_location && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{listing.specific_location}</span>
                  </>
                )}
                {listing.distance_category && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                      {getDistanceBadgeText(listing.distance_category)}
                    </span>
                  </>
                )}
              </div>

              {/* Gender Badge - display prominently if not mixed */}
              {listing.gender && listing.gender !== 'mixed' && (
                <div
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold text-white ${
                    listing.gender === 'female' ? 'bg-pink-600' : 'bg-blue-600'
                  }`}
                >
                  {listing.gender === 'female'
                    ? '👩 Ladies Only'
                    : '👨 Gents Only'}
                </div>
              )}

              <ListingViewCountsLine
                listingId={listing.id}
                initialCounts={initialViewCounts}
              />

              <h2 className="flex items-center gap-1.5 text-slate-500 font-semibold text-sm">
                <MapPin className="h-4 w-4 text-slate-400" />
                {listing.location}
              </h2>

              <p className="text-sm text-slate-600 font-medium">
                Room type:{' '}
                <span className="font-semibold text-slate-900">
                  {bestVariant?.room_type || listing.room_type || 'Self Contained'}
                </span>
                {' · '}Price from:{' '}
                <span className="font-semibold text-slate-900">
                  KES {startingPrice.toLocaleString()}/month
                </span>
                {listing.distance_to_campus && (
                  <>
                    {' · '}
                    <span>{listing.distance_to_campus} from DeKUT</span>
                  </>
                )}
              </p>
            </div>

            <hr className="border-slate-100" />

            <QuickFacts
              roomType={listing.room_type}
              bathroom={listing.bathroom_type}
              internet={listing.wifi_included}
              electricity={listing.electricity_included}
              hotWater={!!listing.hot_water_included}
              cookingGas={!!listing.cooking_gas_included}
              distance={listing.distance_to_campus}
              security={listing.security_type}
            />

            <hr className="border-slate-100" />

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-950">
                About this hostel
              </h2>
              <ListingDescription description={listing.description} />
            </div>

            <hr className="border-slate-100" />
            <AmenitiesGrid amenities={listing.amenities || []} />

            <hr className="border-slate-100" />
            <IncludedUtilities
              waterIncluded={listing.water_included}
              electricityIncluded={listing.electricity_included}
              wifiIncluded={listing.wifi_included}
              hotWaterIncluded={listing.hot_water_included}
              cookingGasIncluded={listing.cooking_gas_included}
              securityType={listing.security_type}
            />

            {/* How to Pay Rent section - only if mpesa_details exist */}
            {listing.mpesa_details && (
              <>
                <hr className="border-slate-100" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-950">
                      How to Pay Rent
                    </h2>
                    {/* M-Pesa icon/emoji */}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700">
                      {listing.mpesa_details}
                    </p>
                  </div>
                </div>
              </>
            )}

            <hr className="border-slate-100" />
            <RoomTypes
              roomTypes={listing.listing_room_types || []}
              fallbackPrice={listing.price}
              startingPrice={startingPrice}
            />
            <hr className="border-slate-100" />

            {listing.youtube_id && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-950">
                    Take a Video Tour
                  </h2>
                  <LazyYouTube
                    videoId={listing.youtube_id}
                    title={`${listing.title} — hostel walkthrough video`}
                    isShort={listing.is_youtube_shorts}
                  />
                  <p className="text-xs font-semibold text-slate-500">
                    Walkthrough video provided by the host.
                  </p>
                </div>
              </>
            )}

            <ReviewsSection
              listingId={String(listing.id)}
              listingUrl={canonicalUrl}
              listingName={listing.title}
              listingArea={listing.area}
              listingImageUrl={images[0]?.r2_url}
            />
            <hr className="border-slate-100" />

            {/* LocationSection hidden per product decision; code preserved for future use */}
            {/* {hasCoordinates && (
              <>
                <LocationSection
                  listingTitle={listing.title}
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                />
                <hr className="border-slate-100" />
              </>
            )} */}

          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Starting from
                </span>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      KES {startingPrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/mo</span>
                  </div>
                  {bestVariant && (
                    <p className="text-xs font-semibold text-slate-400 mt-1">
                      {bestVariant.room_type}
                    </p>
                  )}
                </div>
                {moveInFrom != null && (
                  <div className="mt-3 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl px-4 py-3 border border-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Move in from</span>
                      <span className="text-lg font-black text-emerald-900 tabular-nums">
                        KES {moveInFrom.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                      KES {startingPrice.toLocaleString()} rent + KES {startingDeposit!.toLocaleString()} deposit
                    </p>
                  </div>
                )}
              </div>
              <div className="h-px bg-slate-100" />
              <div className="space-y-3.5">
                {listing.water_included && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Water Included</span>
                  </div>
                )}
                {listing.security_type && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Security {listing.security_type}</span>
                  </div>
                )}
                {listing.wifi_included && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>WiFi Included</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <BookTourButton
                    listingId={listing.id}
                    listingTitle={listing.title}
                    listingZone={listing.area}
                    agentId={listing.agents?.id}
                    zoneTourPrice={zoneTourPrice}
                    listingCampusId={embeddedCampus?.id || null}
                  />
                </div>
                <div className="flex-1">
                  <ContactButton
                    listingId={listing.id}
                    listingTitle={listing.title}
                    agentId={listing.agents?.id}
                    agentPhone={listing.agents?.whatsapp || listing.agents?.phone || ''}
                    landlordPhone={listing.landlord_phone}
                    paysCommission={listing.pays_commission ?? false}
                    consultationFee={readCampusConsultationFee(listing.campuses)}
                    isFull={isListingFull}
                  />
                </div>
              </div>
              {listing.agents && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm uppercase border border-emerald-100 shrink-0">
                      {listing.agents.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      {agentSlug ? (
                        <Link
                          href={`/agents/${agentSlug}`}
                          className="font-bold text-sm text-slate-900 hover:text-emerald-600 leading-tight block truncate"
                        >
                          {listing.agents.name}
                        </Link>
                      ) : (
                        <p className="font-bold text-sm text-slate-900 leading-tight truncate">
                          {listing.agents.name}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        <ShieldCheck className="h-3 w-3" />
                        Verified Agent
                      </span>
                    </div>
                  </div>
                  {agentSlug && (
                    <Link
                      href={`/agents/${agentSlug}`}
                      className="block w-full text-center h-11 rounded-xl border-2 border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-700 text-sm font-bold transition-colors leading-[44px]"
                    >
                      View Profile
                    </Link>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Agent Card */}
      {listing.agents && (
        <div className="container mx-auto px-4 lg:px-8 pb-10 lg:hidden">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Your Agent
            </p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base uppercase border border-emerald-100 shrink-0">
                {listing.agents.name.substring(0, 2)}
              </div>
              <div className="min-w-0">
                {agentSlug ? (
                  <Link
                    href={`/agents/${agentSlug}`}
                    className="font-bold text-sm text-slate-900 hover:text-emerald-600 leading-tight block truncate"
                  >
                    {listing.agents.name}
                  </Link>
                ) : (
                  <p className="font-bold text-sm text-slate-900 leading-tight truncate">
                    {listing.agents.name}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Agent
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {nearbyListings.length > 0 && (
        <section className="container mx-auto px-4 lg:px-8 pb-16">
          <div className="border-t border-slate-100 pt-10">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  More places to stay nearby
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Other verified rooms close to this hostel.
                </p>
              </div>
              <Link
                href={`/hostels/${county}/${area}`}
                className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {nearbyListings.map((item) => {
                const sortedImages = (item.listing_images || []).sort(
                  (a: any, b: any) => a.display_order - b.display_order,
                );
                const imageUrl = sortedImages[0]?.r2_url;
                const blurDataUrl = sortedImages[0]?.blur_data_url;
                const href = item.slug
                  ? `/hostels/${item.county || county}/${item.area || area}/${item.slug}`
                  : `/listing/${item.id}`;

                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={`${item.title} - nearby student hostel near DeKUT Nyeri`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          placeholder={blurDataUrl ? 'blur' : undefined}
                          blurDataURL={blurDataUrl || undefined}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                          No image
                        </div>
                      )}
                      <div className="absolute right-3 top-3 rounded-lg border border-slate-100/60 bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-sm">
                        KES {item.price.toLocaleString()}/mo
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <h3 className="line-clamp-1 font-bold text-slate-900 transition-colors group-hover:text-emerald-600">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">
                        {item.distance_to_campus ||
                          item.room_type ||
                          item.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="truncate font-semibold text-slate-400">
                          {item.agents?.name || 'Verified agent'}
                        </span>
                        <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600">
                          View
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3.5 lg:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
        <div className="flex gap-2">
          <div className="flex-1">
            <BookTourButton
              listingId={listing.id}
              listingTitle={listing.title}
              listingZone={listing.area}
              agentId={listing.agents?.id}
              zoneTourPrice={zoneTourPrice}
              listingCampusId={embeddedCampus?.id || null}
            />
          </div>
            <div className="flex-1">
              <ContactButton
                listingId={listing.id}
                listingTitle={listing.title}
                agentId={listing.agents?.id}
                agentPhone={listing.agents?.whatsapp || listing.agents?.phone || ''}
                landlordPhone={listing.landlord_phone}
                paysCommission={listing.pays_commission ?? false}
                consultationFee={readCampusConsultationFee(listing.campuses)}
                isFull={isListingFull}
              />
            </div>
        </div>
      </div>
    </div>
  );
}
