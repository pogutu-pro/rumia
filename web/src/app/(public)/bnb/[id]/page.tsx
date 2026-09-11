import React from 'react';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Users,
  BedDouble,
  Bath,
  ShieldCheck,
  CheckCircle2,
  BadgeCheck,
  CalendarDays,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { bnbApi } from '@/lib/api/bnb';
import { ImageGallery } from '@/app/(public)/listing/[id]/image-gallery';
import { AmenitiesGrid } from '@/app/(public)/listing/[id]/amenities-grid';
import { ReservationCard } from './reservation-card';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';
import { formatCurrency } from '@/lib/utils/currency';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

const getBnbListing = cache(async (id: string) => {
  try {
    const listing = await bnbApi.getByIdServer(id);
    if (!listing || !listing.is_active) return null;
    return listing;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getBnbListing(id);
  if (!listing) return { title: 'Stay Not Found' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';
  const url = `${baseUrl}/bnb/${id}`;
  const bnb = listing.bnb;
  const priceUnit =
    bnb?.price_unit === 'month'
      ? 'month'
      : bnb?.price_unit === 'week'
        ? 'week'
        : 'night';
  const description =
    `${listing.title} — ${listing.location}. From ${formatCurrency(listing.price)} per ${priceUnit}. ${listing.description?.slice(0, 100) ?? ''}`.slice(
      0,
      155,
    );
  const firstImage = listing.images?.[0]?.r2_url;

  return {
    title: `${listing.title} — RumiaBnB`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${listing.title} | RumiaBnB`,
      description,
      url,
      siteName: 'Rumia',
      type: 'website',
      ...(firstImage
        ? { images: [{ url: firstImage, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${listing.title} | RumiaBnB`,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

function listingTypeLabel(type?: string | null) {
  if (type === 'private_room') return 'Private room';
  if (type === 'shared_space') return 'Shared space';
  return 'Entire place';
}

function priceUnitLabel(unit?: string | null) {
  if (unit === 'week') return 'per week';
  if (unit === 'month') return 'per month';
  return 'per night';
}

function bedLabel(type: string, qty: number) {
  const t = type.toLowerCase();
  return `${qty} ${t}${qty !== 1 ? (t.endsWith('s') ? '' : 's') : ''}`;
}

function formatDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default async function BnbDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getBnbListing(id);
  if (!listing) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke';
  const canonicalUrl = `${baseUrl}/bnb/${id}`;

  const images = [...(listing.images ?? [])].sort(
    (a: any, b: any) => a.display_order - b.display_order,
  );

  const bnb = listing.bnb;
  const agent = listing.agent;
  const agentSlug = agent?.slug;

  const priceUnit = priceUnitLabel(bnb?.price_unit);
  const listingType = listingTypeLabel(bnb?.listing_type);

  const bedConfig: { type: string; qty: number }[] = bnb?.bed_config ?? [];

  const houseRules: Record<string, unknown> = bnb?.house_rules ?? {};
  const customRules: string | null = bnb?.custom_rules ?? null;

  const guestSuitability: string[] = bnb?.guest_suitability ?? [];

  const hasAvailability = bnb?.available_from || bnb?.available_until;
  const hasCheckTimes = bnb?.check_in_time || bnb?.check_out_time;

  return (
    <div className="relative min-h-screen bg-white pb-24 md:pb-16 font-sans">
      {/* Top bar */}
      <div className="border-b border-slate-100 bg-white sticky top-0 z-30 hidden md:block">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/bnb"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to stays
          </Link>
          <div className="flex items-center gap-4">
            <ShareListingButton
              listing={{
                name: listing.title,
                area: listing.area,
                url: canonicalUrl,
                imageUrl: images[0]?.r2_url,
              }}
              className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            />
            <SaveButton listingId={String(listing.id)} />
          </div>
        </div>
      </div>

      {/* Mobile back + actions */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 pt-4 md:hidden">
        <Link
          href="/bnb"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
          aria-label="Back to stays"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <SaveButton listingId={String(listing.id)} variant="icon" />
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

      {/* Gallery */}
      <div className="md:container md:mx-auto md:px-4 lg:px-8 md:pt-6">
        <ImageGallery images={images} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  {listingType}
                </span>
                {listing.verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                {listing.title}
              </h1>

              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{listing.location}</span>
                {listing.area && listing.area !== listing.location && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{listing.area}</span>
                  </>
                )}
              </div>

              {/* Capacity row */}
              {bnb && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 pt-1">
                  {bnb.max_guests && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-slate-400" />
                      {bnb.max_guests} guest{bnb.max_guests !== 1 ? 's' : ''}
                    </span>
                  )}
                  {bnb.bedrooms != null && (
                    <span className="flex items-center gap-1.5">
                      <BedDouble className="h-4 w-4 text-slate-400" />
                      {bnb.bedrooms} bedroom{bnb.bedrooms !== 1 ? 's' : ''}
                    </span>
                  )}
                  {bnb.bathrooms != null && (
                    <span className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-slate-400" />
                      {bnb.bathrooms} bathroom{bnb.bathrooms !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-baseline gap-1.5 pt-2 lg:hidden">
                <span className="text-2xl font-black tracking-tight text-slate-950">
                  {formatCurrency(listing.price)}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  {priceUnit}
                </span>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Host */}
            {agent && (
              <>
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-base font-bold uppercase text-emerald-700">
                      {agent.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      {agentSlug ? (
                        <Link
                          href={`/agents/${agentSlug}`}
                          className="block truncate font-bold leading-tight text-slate-900 hover:text-emerald-600"
                        >
                          Hosted by {agent.name}
                        </Link>
                      ) : (
                        <p className="truncate font-bold leading-tight text-slate-900">Hosted by {agent.name}</p>
                      )}
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Rumia host
                      </span>
                    </div>
                  </div>
                  {agentSlug && (
                    <Link
                      href={`/agents/${agentSlug}`}
                      className="shrink-0 text-sm font-bold text-slate-700 underline underline-offset-4 hover:text-emerald-700"
                    >
                      View profile
                    </Link>
                  )}
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* Description */}
            {listing.description && (
              <>
                <div className="space-y-3">
                  <h2 className="text-xl font-bold text-slate-950">
                    About this property
                  </h2>
                  <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* Sleeping arrangements */}
            {bedConfig.length > 0 && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-950">
                    Where you&apos;ll sleep
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {bedConfig.map((bed, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <BedDouble className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="font-medium text-slate-800">
                          {bedLabel(bed.type, bed.qty)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <>
                <AmenitiesGrid amenities={listing.amenities} />
                <hr className="border-slate-100" />
              </>
            )}

            {/* Availability */}
            {(hasAvailability || hasCheckTimes || bnb?.min_stay_nights) && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-950">
                    Availability
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bnb?.available_from && (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                        <CalendarDays className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Available from
                          </p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">
                            {formatDate(bnb.available_from)}
                          </p>
                        </div>
                      </div>
                    )}
                    {bnb?.available_until && (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                        <CalendarDays className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Available until
                          </p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">
                            {formatDate(bnb.available_until)}
                          </p>
                        </div>
                      </div>
                    )}
                    {bnb?.check_in_time && (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                        <Clock className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Check-in
                          </p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">
                            {bnb.check_in_time}
                          </p>
                        </div>
                      </div>
                    )}
                    {bnb?.check_out_time && (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                        <Clock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Check-out
                          </p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">
                            {bnb.check_out_time}
                          </p>
                        </div>
                      </div>
                    )}
                    {bnb?.advance_notice_hours != null && (
                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Advance notice
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-900">
                            {bnb.advance_notice_hours} hours
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {bnb?.min_stay_nights && bnb.min_stay_nights > 1 && (
                    <p className="text-sm text-slate-500 font-medium">
                      Minimum stay:{' '}
                      <span className="font-semibold text-slate-800">
                        {bnb.min_stay_nights} nights
                      </span>
                      {bnb.max_stay_nights
                        ? ` · Maximum: ${bnb.max_stay_nights} nights`
                        : ''}
                    </p>
                  )}
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* House rules */}
            {(Object.keys(houseRules).length > 0 || customRules) && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-950">
                    House rules
                  </h2>
                  <div className="space-y-2.5">
                    {houseRules.smoking === false && (
                      <RuleRow
                        icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
                        label="No smoking"
                      />
                    )}
                    {houseRules.pets === false && (
                      <RuleRow
                        icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
                        label="No pets"
                      />
                    )}
                    {houseRules.parties === false && (
                      <RuleRow
                        icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
                        label="No parties or events"
                      />
                    )}
                    {houseRules.visitors === true && (
                      <RuleRow
                        icon={
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        }
                        label="Visitors allowed"
                      />
                    )}
                    {houseRules.children === true && (
                      <RuleRow
                        icon={
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        }
                        label="Children welcome"
                      />
                    )}
                    {!!houseRules.quiet_hours && (
                      <RuleRow
                        icon={<Clock className="h-4 w-4 text-slate-500" />}
                        label={`Quiet hours: ${String(houseRules.quiet_hours)}`}
                      />
                    )}
                    {customRules && (
                      <p className="text-sm text-slate-600 leading-relaxed pt-1 border-t border-slate-100 mt-3">
                        {customRules}
                      </p>
                    )}
                  </div>
                </div>
                <hr className="border-slate-100" />
              </>
            )}

            {/* Guest suitability */}
            {guestSuitability.length > 0 && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-950">Good for</h2>
                  <div className="flex flex-wrap gap-2">
                    {guestSuitability.map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100" />
              </>
            )}

          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <ReservationCard
                listingTitle={listing.title}
                location={listing.location}
                price={listing.price}
                priceUnit={priceUnit}
                hostPhone={agent?.whatsapp || agent?.phone || ''}
                cleaningFee={bnb?.cleaning_fee}
                securityDeposit={bnb?.security_deposit}
                extraGuestFee={bnb?.extra_guest_fee}
                minStayNights={bnb?.min_stay_nights}
                availableFrom={bnb?.available_from}
                availableUntil={bnb?.available_until}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3.5 md:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {formatCurrency(listing.price)}
              <span className="text-xs font-medium text-slate-500 ml-1">
                {priceUnit}
              </span>
            </p>
          </div>
          <div className="max-w-[220px] flex-1">
            <ReservationCard
              compact
              listingTitle={listing.title}
              location={listing.location}
              price={listing.price}
              priceUnit={priceUnit}
              hostPhone={agent?.whatsapp || agent?.phone || ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-700">
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  );
}
