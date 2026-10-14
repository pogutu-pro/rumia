import { listingPath } from '@/lib/utils/listing-path';
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
  PlayCircle,
  Navigation,
  Home,
  Wallet,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';
import { bnbApi } from '@/lib/api/bnb';
import { ImageGallery } from '@/app/(public)/listing/[id]/image-gallery';
import { AmenitiesGrid } from '@/app/(public)/listing/[id]/amenities-grid';
import { LazyYouTube } from '@/components/seo/lazy-youtube';
import { ReservationCard } from './[id]/reservation-card';
import { ContextBackLink } from '@/components/shell/nav-history';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';
import { formatCurrency } from '@/lib/utils/currency';


export const getBnbListing = cache(async (id: string) => {
  try {
    const listing = await bnbApi.getByIdServer(id);
    if (!listing || !listing.is_active) return null;
    return listing;
  } catch {
    return null;
  }
});

/** Metadata for a short stay, whichever URL it was reached by. */
export async function bnbMetadata(id: string): Promise<Metadata> {
  const listing = await getBnbListing(id);
  if (!listing) return { title: 'Stay Not Found' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
  const url = `${baseUrl}${listingPath({ ...listing, property_type: 'short_stay' })}`;
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

/** The short-stay page. Rendered at /{market}/short-stays/{place}/{name}. */
export async function BnbDetail({ id }: { id: string }) {
  const listing = await getBnbListing(id);
  if (!listing) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';
  const canonicalUrl = `${baseUrl}${listingPath({ ...listing, property_type: 'short_stay' })}`;

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

  const totalBeds = bedConfig.reduce((n, b) => n + (b.qty || 0), 0);
  const facts = [
    bnb?.max_guests ? { icon: Users, value: bnb.max_guests, label: bnb.max_guests === 1 ? 'Guest' : 'Guests' } : null,
    bnb?.bedrooms != null ? { icon: DoorOpen, value: bnb.bedrooms, label: bnb.bedrooms === 1 ? 'Bedroom' : 'Bedrooms' } : null,
    totalBeds > 0 ? { icon: BedDouble, value: totalBeds, label: totalBeds === 1 ? 'Bed' : 'Beds' } : null,
    bnb?.bathrooms != null ? { icon: Bath, value: bnb.bathrooms, label: bnb.bathrooms === 1 ? 'Bathroom' : 'Bathrooms' } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  const hasFees = !!(bnb?.cleaning_fee || bnb?.security_deposit || bnb?.extra_guest_fee);
  const hasRules = Object.keys(houseRules).length > 0 || !!customRules;
  const sections = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'about', label: 'About', show: !!listing.description },
    { id: 'video', label: 'Video', show: !!listing.youtube_id },
    { id: 'sleeping', label: 'Sleeping', show: bedConfig.length > 0 },
    { id: 'amenities', label: 'Amenities', show: !!listing.amenities?.length },
    { id: 'pricing', label: 'Fees', show: hasFees },
    { id: 'availability', label: 'Availability', show: !!(hasAvailability || hasCheckTimes || bnb?.min_stay_nights) },
    { id: 'rules', label: 'Rules', show: hasRules },
  ].filter((x) => x.show);

  return (
    <div className="relative min-h-screen bg-slate-50 pb-24 md:pb-16 font-sans">
      {/* Top bar */}
      <div className="border-b border-slate-100 bg-white sticky top-[var(--shell-header-h)] z-30 hidden md:block">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <ContextBackLink fallbackHref="/bnb"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to stays
          </ContextBackLink>
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
        <ContextBackLink fallbackHref="/bnb"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
          aria-label="Back to stays"
        >
          <ArrowLeft className="h-5 w-5" />
        </ContextBackLink>
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

      {/* Section jump nav */}
      <nav
        aria-label="Sections"
        className="sticky top-[var(--shell-header-h)] z-20 border-y border-slate-200 bg-white/95 backdrop-blur md:top-[calc(var(--shell-header-h)+4.25rem)] md:mt-4"
      >
        <div className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 lg:px-8 [scrollbar-width:none]">
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              {sec.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Main content */}
          <div className="space-y-5 lg:col-span-2">
            {/* Header */}
            <header id="overview" className="scroll-mt-32 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                  {listingType}
                </span>
                {listing.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-primary">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {listing.youtube_id && (
                  <a
                    href="#video"
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Video tour
                  </a>
                )}
              </div>

              <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                {listing.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-slate-600">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{listing.location}</span>
                {listing.area && listing.area !== listing.location && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{listing.area}</span>
                  </>
                )}
                {bnb?.nearby_landmark && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Navigation className="h-3.5 w-3.5" />
                      Near {bnb.nearby_landmark}
                    </span>
                  </>
                )}
              </div>

              {facts.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {facts.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3"
                    >
                      <f.icon className="h-5 w-5 shrink-0 text-primary" />
                      <div className="leading-tight">
                        <p className="text-base font-black text-slate-950">{f.value}</p>
                        <p className="text-xs font-semibold text-slate-500">{f.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {agent && (
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-sm font-bold uppercase text-primary">
                      {agent.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      {agentSlug ? (
                        <Link
                          href={`/agents/${agentSlug}`}
                          className="block truncate text-sm font-bold text-slate-900 hover:text-primary"
                        >
                          Hosted by {agent.name}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-bold text-slate-900">
                          Hosted by {agent.name}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Rumia host
                      </span>
                    </div>
                  </div>
                  {agentSlug && (
                    <Link
                      href={`/agents/${agentSlug}`}
                      className="shrink-0 text-xs font-bold text-slate-700 underline underline-offset-4 hover:text-primary"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              )}
            </header>

            {/* Description */}
            {listing.description && (
              <SectionCard id="about" title="About this place" icon={Home}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {listing.description}
                </p>
              </SectionCard>
            )}

            {/* Video tour */}
            {listing.youtube_id && (
              <SectionCard id="video" title="Video tour" icon={PlayCircle}>
                <LazyYouTube
                  videoId={listing.youtube_id}
                  title={`${listing.title} — video tour`}
                  isShort={listing.is_youtube_shorts}
                />
                <p className="text-xs font-semibold text-slate-500">
                  Walkthrough video provided by the host.
                </p>
              </SectionCard>
            )}

            {/* Sleeping arrangements */}
            {bedConfig.length > 0 && (
              <SectionCard id="sleeping" title="Where you'll sleep" icon={BedDouble}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {bedConfig.map((bed, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm"
                    >
                      <BedDouble className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="font-medium text-slate-800">
                        {bedLabel(bed.type, bed.qty)}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div id="amenities" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <AmenitiesGrid amenities={listing.amenities} />
              </div>
            )}

            {/* Pricing & fees */}
            {hasFees && (
              <SectionCard id="pricing" title="Pricing & fees" icon={Wallet}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Fee label={`Base ${priceUnit}`} value={formatCurrency(listing.price)} />
                  {bnb?.cleaning_fee ? <Fee label="Cleaning fee" value={formatCurrency(bnb.cleaning_fee)} /> : null}
                  {bnb?.security_deposit ? <Fee label="Security deposit" value={formatCurrency(bnb.security_deposit)} /> : null}
                  {bnb?.extra_guest_fee ? <Fee label="Extra guest" value={formatCurrency(bnb.extra_guest_fee)} /> : null}
                </div>
              </SectionCard>
            )}

            {/* Availability + rules side by side */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {(hasAvailability || hasCheckTimes || bnb?.min_stay_nights || bnb?.advance_notice_hours != null) && (
                <SectionCard id="availability" title="Availability" icon={CalendarDays}>
                  <dl className="space-y-2.5 text-sm">
                    {bnb?.available_from && <InfoRow label="Available from" value={formatDate(bnb.available_from)!} />}
                    {bnb?.available_until && <InfoRow label="Available until" value={formatDate(bnb.available_until)!} />}
                    {bnb?.check_in_time && <InfoRow label="Check-in" value={bnb.check_in_time} />}
                    {bnb?.check_out_time && <InfoRow label="Check-out" value={bnb.check_out_time} />}
                    {bnb?.advance_notice_hours != null && (
                      <InfoRow label="Advance notice" value={`${bnb.advance_notice_hours} hours`} />
                    )}
                    {bnb?.min_stay_nights != null && (
                      <InfoRow
                        label="Stay length"
                        value={`${bnb.min_stay_nights} night${bnb.min_stay_nights !== 1 ? 's' : ''} min${bnb.max_stay_nights ? `, ${bnb.max_stay_nights} max` : ''}`}
                      />
                    )}
                  </dl>
                </SectionCard>
              )}

              {(Object.keys(houseRules).length > 0 || customRules) && (
                <SectionCard id="rules" title="House rules" icon={ShieldCheck}>
                  <div className="space-y-2.5">
                    {houseRules.smoking === false && (
                      <RuleRow icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="No smoking" />
                    )}
                    {houseRules.pets === false && (
                      <RuleRow icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="No pets" />
                    )}
                    {houseRules.parties === false && (
                      <RuleRow icon={<AlertCircle className="h-4 w-4 text-rose-500" />} label="No parties or events" />
                    )}
                    {houseRules.visitors === true && (
                      <RuleRow icon={<CheckCircle2 className="h-4 w-4 text-primary" />} label="Visitors allowed" />
                    )}
                    {houseRules.children === true && (
                      <RuleRow icon={<CheckCircle2 className="h-4 w-4 text-primary" />} label="Children welcome" />
                    )}
                    {!!houseRules.quiet_hours && (
                      <RuleRow
                        icon={<Clock className="h-4 w-4 text-slate-500" />}
                        label={`Quiet hours: ${String(houseRules.quiet_hours)}`}
                      />
                    )}
                    {customRules && (
                      <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
                        {customRules}
                      </p>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Guest suitability */}
            {guestSuitability.length > 0 && (
              <SectionCard id="good-for" title="Good for" icon={Users}>
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
              </SectionCard>
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

      {/* Mobile sticky footer: the only fixed bar on this page (the bottom navigation steps aside). The spacer keeps the last section clear of it. */}
      <div aria-hidden className="h-[calc(5.5rem+env(safe-area-inset-bottom))] lg:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
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

function SectionCard({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Fee({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-black text-slate-950">{value}</p>
    </div>
  );
}
