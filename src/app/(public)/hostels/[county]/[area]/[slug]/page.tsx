import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  ArrowLeft,
  ArrowRight,
  Heart,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { ImageGallery } from '@/app/(public)/listing/[id]/image-gallery';
import { WhatsappButton } from '@/app/(public)/listing/[id]/whatsapp-button';
import { QuickFacts } from '@/app/(public)/listing/[id]/quick-facts';
import { AmenitiesGrid } from '@/app/(public)/listing/[id]/amenities-grid';
import { LocationSection } from '@/app/(public)/listing/[id]/location-section';
import { RoomTypes } from '@/app/(public)/listing/[id]/room-types';
import { ShareButton } from '@/components/ui/share-button';
import { LazyYouTube } from '@/components/seo/lazy-youtube';
import { JsonLd } from '@/components/seo/json-ld';
import { ListingViewTracker } from './listing-view-tracker';
import { ListingDescription } from './listing-description';
import {
  formatListingViewLine,
  getListingViewCounts,
} from '@/lib/listing-views';
import { getDistanceBadgeText } from '@/lib/constants/dekut-areas';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ county: string; area: string; slug: string }>;
}

const getListing = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, price, location, agent_id, youtube_id,
      is_active, amenities, rating, views, bathroom_type, distance_to_campus,
      security_type, electricity_included, water_included, wifi_included,
      room_type, slug, county, area, updated_at, latitude, longitude,
      gender, specific_location, price_single, price_sharing, mpesa_details, distance_category,
      listing_images ( id, r2_url, display_order ),
      agents ( id, name, phone, whatsapp, slug )
    `,
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  const { data: roomTypes } = await supabase
    .from('listing_room_types')
    .select('id, room_type, price, is_available')
    .eq('listing_id', data.id);

  return { ...data, listing_room_types: roomTypes || [] } as any;
});

async function getNearbyListings(listing: any) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, price, location, slug, county, area,
      room_type, distance_to_campus,
      listing_images ( r2_url, display_order ),
      agents ( name )
    `,
    )
    .eq('is_active', true)
    .eq('county', listing.county || 'nyeri')
    .eq('area', listing.area || 'dekut')
    .neq('id', listing.id)
    .order('created_at', { ascending: false })
    .limit(4);

  if (error || !data) return [];
  return data as any[];
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
  const canonicalUrl = `https://rumia.co.ke/hostels/${county}/${area}/${slug}`;
  const coverImage = listing.listing_images?.sort(
    (a: any, b: any) => a.display_order - b.display_order,
  )[0]?.r2_url;
  const previewImage = `${canonicalUrl}/opengraph-image`;
  const imageAlt = `${listing.title} — student hostel near DeKUT Nyeri`;

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
      images: [
        { url: previewImage, width: 1200, height: 630, alt: imageAlt },
        ...(coverImage
          ? [{ url: coverImage, width: 1200, height: 630, alt: imageAlt }]
          : []),
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [previewImage],
    },
  };
}

export default async function ListingSlugPage({ params }: PageProps) {
  const { county, area, slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  const images = (listing.listing_images || []).sort(
    (a: any, b: any) => a.display_order - b.display_order,
  );
  const canonicalUrl = `https://rumia.co.ke/hostels/${county}/${area}/${slug}`;
  const shareText = [
    `${listing.room_type || listing.listing_room_types?.[0]?.room_type || 'Student hostel'} from KES ${listing.price.toLocaleString()}/month`,
    listing.distance_to_campus
      ? `${listing.distance_to_campus} from DeKUT`
      : null,
    listing.location,
  ]
    .filter(Boolean)
    .join(' · ');
  const agentSlug = listing.agents?.slug;
  const nearbyListings = await getNearbyListings(listing);
  const viewCounts = await getListingViewCounts(listing.id);
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
    priceRange: `KES ${listing.price.toLocaleString()} per month`,
    provider: listing.agents
      ? {
          '@type': 'Person',
          name: listing.agents.name,
          url: agentSlug
            ? `https://rumia.co.ke/agents/${agentSlug}`
            : undefined,
        }
      : undefined,
  };

  return (
    <div className="relative min-h-screen bg-white pb-24 md:pb-16 font-sans">
      <JsonLd data={accommodationSchema} />
      <ListingViewTracker listingId={listing.id} />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 pt-4 md:hidden">
        <Link
          href={`/hostels/${county}/${area}`}
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950"
          aria-label={`Back to ${area.toUpperCase()} hostels`}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="pointer-events-auto">
          <ShareButton
            title={listing.title}
            text={shareText}
            url={canonicalUrl}
            showLabel={false}
            size="icon"
            className="h-11 w-11 rounded-full border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm hover:bg-white hover:text-slate-950"
          />
        </div>
      </div>

      {/* Top Bar */}
      <div className="border-b border-slate-100 bg-white sticky top-0 z-30 hidden md:block">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href={`/hostels/${county}/${area}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {area.toUpperCase()} hostels
          </Link>
          <div className="flex items-center gap-4">
            <ShareButton
              title={listing.title}
              text={shareText}
              url={canonicalUrl}
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            />
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              <Heart className="h-4 w-4" /> Save
            </button>
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

              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
                <Eye className="h-4 w-4" />
                {formatListingViewLine(viewCounts)}
              </p>

              <h2 className="flex items-center gap-1.5 text-slate-500 font-semibold text-sm">
                <MapPin className="h-4 w-4 text-slate-400" />
                {listing.location}
              </h2>

              <p className="text-sm text-slate-600 font-medium">
                Room type:{' '}
                <span className="font-semibold text-slate-900">
                  {listing.room_type || 'Self Contained'}
                </span>
                {' · '}Price from:{' '}
                <span className="font-semibold text-slate-900">
                  KES {listing.price.toLocaleString()}/month
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

            {hasCoordinates && (
              <>
                <hr className="border-slate-100" />
                <LocationSection
                  listingTitle={listing.title}
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                />
              </>
            )}

            <hr className="border-slate-100" />
            <RoomTypes
              roomTypes={listing.listing_room_types || []}
              fallbackPrice={listing.price}
            />
            <hr className="border-slate-100" />

            {listing.youtube_id && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Take a Video Tour
                </h2>
                <LazyYouTube
                  videoId={listing.youtube_id}
                  title={`${listing.title} — hostel walkthrough video`}
                />
                <p className="text-xs font-semibold text-slate-500">
                  Walkthrough video provided by the host.
                </p>
              </div>
            )}

            {listing.youtube_id && <hr className="border-slate-100" />}

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">
                Student Reviews
              </h2>
              <p className="text-sm font-semibold text-slate-500 leading-normal">
                Reviews are currently being verified for authenticity. They will
                appear here once complete.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Pricing
                </span>
                <div className="mt-3 space-y-2.5">
                  {listing.price_single && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">
                        KES {listing.price_single.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Single occupancy/month
                      </span>
                    </div>
                  )}
                  {listing.price_sharing && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">
                        KES {listing.price_sharing.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Shared per person/month
                      </span>
                    </div>
                  )}
                  {!listing.price_single && !listing.price_sharing && (
                    <div className="flex items-baseline gap-1 mt-1.5 text-slate-900">
                      <span className="text-3xl font-black">
                        KES {listing.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">
                        / month
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    Water {listing.water_included ? 'Included' : 'Available'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Security {listing.security_type || 'Available'}</span>
                </div>
                {listing.wifi_included && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>WiFi Included</span>
                  </div>
                )}
              </div>
              <WhatsappButton
                listingId={listing.id}
                agentId={listing.agents?.id}
                agentPhone={
                  listing.agents?.whatsapp || listing.agents?.phone || ''
                }
              />
              {listing.agents && (
                <div className="pt-4 border-t border-slate-100 text-center space-y-3">
                  <div className="flex items-center gap-3 justify-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm uppercase">
                      {listing.agents.name.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      {agentSlug ? (
                        <Link
                          href={`/agents/${agentSlug}`}
                          className="font-bold text-sm text-slate-900 hover:text-emerald-600 leading-tight block"
                        >
                          {listing.agents.name}
                        </Link>
                      ) : (
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                          {listing.agents.name}
                        </h3>
                      )}
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Verified Agent
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

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
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3.5 flex items-center justify-between md:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
        <div>
          {listing.price_single && listing.price_sharing && (
            <div className="text-sm">
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-black text-slate-950">
                  KES {listing.price_single.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  single
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-black text-slate-950">
                  KES {listing.price_sharing.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  sharing
                </span>
              </div>
            </div>
          )}
          {listing.price_single && !listing.price_sharing && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-black text-slate-950">
                KES {listing.price_single.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">/mo</span>
            </div>
          )}
          {listing.price_sharing && !listing.price_single && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-black text-slate-950">
                KES {listing.price_sharing.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">/mo</span>
            </div>
          )}
          {!listing.price_single && !listing.price_sharing && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-black text-slate-950">
                KES {listing.price.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">/mo</span>
            </div>
          )}
        </div>
        <div className="w-[60%]">
          <WhatsappButton
            listingId={listing.id}
            agentId={listing.agents?.id}
            agentPhone={listing.agents?.whatsapp || listing.agents?.phone || ''}
          />
        </div>
      </div>
    </div>
  );
}
