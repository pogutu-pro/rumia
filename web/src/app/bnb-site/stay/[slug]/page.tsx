import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { CalendarRange, Clock, KeyRound, MapPin, Play, ReceiptText } from 'lucide-react';
import { getStay, getStays } from '@/lib/site/bnb-api';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { kes, stayCover, stayFacts, stayHost, stayImages, stayKind, stayPath, stayPlace } from '@/lib/site/stay-format';
import { StayGallery } from '@/components/bnb/stay-gallery';
import { BookingCard } from '@/components/bnb/booking-card';
import { Amenities, Description } from '@/components/bnb/stay-sections';
import { ConciergeButton } from '@/components/bnb/concierge-button';
import { StayViewTracker } from '@/components/bnb/stay-view-tracker';
import { StayVideo } from '@/components/bnb/stay-video';
import { JsonLd } from '@/components/seo/json-ld';
import { SaveButton } from '@/components/ui/save-button';
import { ShareListingButton } from '@/components/ui/share-listing-button';

export const revalidate = 300;

export async function generateStaticParams() {
  const stays = await getStays();
  return stays.filter((s) => s.slug).map((s) => ({ slug: s.slug as string }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const stay = await getStay((await params).slug);
  if (!stay) return { title: 'Stay not found', robots: { index: false } };
  const where = stayPlace(stay);
  const description = `${stayKind(stay) ?? 'Short stay'} in ${where}, ${kes(stay.price)} a night. ${stay.description}`.slice(0, 158);
  const cover = stayCover(stay);
  return {
    title: `${stay.title}, ${where}`,
    description,
    alternates: { canonical: stayPath(stay) },
    openGraph: { title: `${stay.title}, ${where}`, description, url: `${BNB_ORIGIN}${stayPath(stay)}`, images: cover ? [{ url: cover }] : undefined },
  };
}

const RULES: Record<string, string> = { smoking: 'Smoking', pets: 'Pets', parties: 'Parties or events', children: 'Children', visitors: 'Visitors' };

export default async function StayPage({ params }: Props) {
  const { slug } = await params;
  const stay = await getStay(slug);
  if (!stay) notFound();

  const b = stay.bnb;
  const host = stayHost(stay);
  const where = stayPlace(stay);
  const ident = stay.slug ?? stay.id;
  const images = stayImages(stay);
  const url = `${BNB_ORIGIN}${stayPath(stay)}`;
  const rules = Object.entries((b?.house_rules ?? {}) as Record<string, unknown>)
    .filter(([k, v]) => RULES[k] && typeof v === 'boolean')
    .map(([k, v]) => `${RULES[k]} ${v ? 'allowed' : 'not allowed'}`);
  const quiet = typeof b?.house_rules?.quiet_hours === 'string' ? `Quiet hours ${b.house_rules.quiet_hours as string}` : null;

  // Only what is true of this place.
  const highlights = [
    stay.youtube_id && { icon: Play, title: 'Video tour', body: 'Walk through the place before you book.' },
    (b?.check_in_time || b?.check_out_time) && {
      icon: KeyRound,
      title: b?.check_in_time ? `Check in from ${b.check_in_time}` : 'Check-out time set',
      body: b?.check_out_time ? `Check out by ${b.check_out_time}.` : 'The host shares arrival details when they confirm.',
    },
    (b?.weekly_price || b?.monthly_price) && { icon: CalendarRange, title: 'Cheaper for longer stays', body: [b?.weekly_price && `${kes(b.weekly_price)} a week`, b?.monthly_price && `${kes(b.monthly_price)} a month`].filter(Boolean).join(', ') + '.' },
    { icon: ReceiptText, title: 'Full price before you ask', body: 'Pick dates and see the total, cleaning fee included. Nothing is charged to request.' },
  ].filter(Boolean) as Array<{ icon: typeof Play; title: string; body: string }>;

  const actions = (
    <>
      <ShareListingButton listing={{ name: stay.title, area: where, url, imageUrl: images[0]?.url }} variant="icon" className="h-11 w-11 rounded-full bg-white shadow-sm" />
      <SaveButton listingId={String(stay.id)} variant="icon" className="h-11 w-11 bg-white shadow-sm" />
    </>
  );
  const section = 'border-t border-bnb-line py-10';
  const h2 = 'font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink';

  return (
    <article className="mx-auto max-w-6xl px-4 pb-32 pt-0 md:px-6 md:pt-8 lg:pb-16">
      <StayViewTracker listingId={stay.id} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VacationRental',
          name: stay.title,
          description: stay.description,
          url,
          image: images.slice(0, 6).map((i) => i.url),
          address: { '@type': 'PostalAddress', addressLocality: where, addressCountry: 'KE' },
          ...(b?.max_guests ? { occupancy: { '@type': 'QuantitativeValue', maxValue: b.max_guests } } : {}),
          amenityFeature: (stay.amenities ?? []).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
        }}
      />

      <div className="mb-6 hidden items-end justify-between gap-4 md:flex">
        <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink">{stay.title}</h1>
        <div className="flex gap-2">{actions}</div>
      </div>

      <StayGallery title={stay.title} images={images} actions={actions} />

      <div className="mt-6 grid gap-x-20 md:mt-10 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          <header className="pb-8">
            <h1 className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink md:hidden">{stay.title}</h1>
            <p className="mt-1 text-lg font-semibold text-bnb-ink md:mt-0 md:text-xl">
              {stayKind(stay) ?? 'Stay'} in {where}
            </p>
            <p className="mt-1 text-bnb-stone">{stayFacts(stay).join(' · ')}</p>
          </header>

          {host && (
            <div className="flex items-center gap-4 border-t border-bnb-line py-6">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-bnb-ink font-bnb-display text-lg font-bold text-white" aria-hidden>
                {host.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-bnb-ink">Hosted by {host}</p>
                <p className="text-sm text-bnb-stone">Hosting with RumiaBnB</p>
              </div>
            </div>
          )}

          <ul className="space-y-6 border-t border-bnb-line py-8">
            {highlights.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-5">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-bnb-ink" strokeWidth={1.5} aria-hidden />
                <div>
                  <p className="font-semibold text-bnb-ink">{title}</p>
                  <p className="text-bnb-stone">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          {stay.description && (
            <section className={section} aria-labelledby="about">
              <h2 id="about" className={`${h2} mb-4`}>
                About this place
              </h2>
              <Description text={stay.description} />
            </section>
          )}

          {stay.youtube_id && (
            <section className={section} aria-labelledby="tour">
              <h2 id="tour" className={`${h2} mb-4`}>
                Video tour
              </h2>
              <StayVideo videoId={stay.youtube_id} isShort={stay.is_youtube_shorts} title={stay.title} listingId={stay.id} />
            </section>
          )}

          {(stay.amenities?.length ?? 0) > 0 && (
            <section className={section} aria-labelledby="amenities">
              <h2 id="amenities" className={`${h2} mb-4`}>
                What this place offers
              </h2>
              <Amenities items={stay.amenities!} />
            </section>
          )}

          <section className={section} aria-labelledby="where">
            <h2 id="where" className={`${h2} mb-4`}>
              Where you&rsquo;ll be
            </h2>
            <p className="flex items-start gap-3 text-bnb-ink">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span>
                {where}
                {b?.nearby_landmark ? `, near ${b.nearby_landmark}` : ''}
                <span className="block text-sm text-bnb-stone">The exact address is shared once the host confirms.</span>
              </span>
            </p>
          </section>

          <section className={section} aria-labelledby="know">
            <h2 id="know" className={`${h2} mb-6`}>
              Things to know
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <h3 className="font-semibold text-bnb-ink">House rules</h3>
                <ul className="mt-2 space-y-1.5 text-bnb-ink/90">
                  {b?.check_in_time && <li>Check-in after {b.check_in_time}</li>}
                  {b?.check_out_time && <li>Checkout before {b.check_out_time}</li>}
                  {b?.max_guests && <li>{b.max_guests} guests maximum</li>}
                  {rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {quiet && <li>{quiet}</li>}
                </ul>
                {b?.custom_rules && <p className="mt-2 whitespace-pre-line text-sm text-bnb-stone">{b.custom_rules}</p>}
              </div>
              <div>
                <h3 className="font-semibold text-bnb-ink">Prices and fees</h3>
                <ul className="mt-2 space-y-1.5 text-bnb-ink/90">
                  <li>{kes(stay.price)} a night</li>
                  {b?.weekly_price && <li>{kes(b.weekly_price)} a week (7+ nights)</li>}
                  {b?.monthly_price && <li>{kes(b.monthly_price)} a month (30+ nights)</li>}
                  {b?.cleaning_fee ? <li>Cleaning fee {kes(b.cleaning_fee)}</li> : null}
                  {b?.security_deposit ? <li>Refundable deposit {kes(b.security_deposit)}</li> : null}
                  {b?.min_stay_nights && b.min_stay_nights > 1 ? <li>Minimum {b.min_stay_nights} nights</li> : null}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-bnb-ink">Booking</h3>
                <ul className="mt-2 space-y-1.5 text-bnb-ink/90">
                  <li>Send a request; the host confirms</li>
                  <li>Pay the host as agreed</li>
                  <li>No fee to guests</li>
                </ul>
              </div>
            </div>
          </section>

          <section className={`${section} flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-bnb-forest" aria-hidden />
              <p className="text-bnb-ink">
                <span className="font-semibold">Questions first?</span> Our team answers on WhatsApp and checks with the host.
              </p>
            </div>
            <ConciergeButton listing={ident} label="Message RumiaBnB" variant="outline" className="shrink-0 whitespace-nowrap" />
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Book this stay">
          <Suspense fallback={null}>
            <BookingCard stay={stay} ident={ident} />
          </Suspense>
        </aside>
      </div>
    </article>
  );
}
