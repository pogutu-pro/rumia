import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, MapPin } from 'lucide-react';
import { getStay, getStays } from '@/lib/site/bnb-api';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { kes, stayCover, stayFacts, stayHost, stayImages, stayKind, stayPath, stayPlace } from '@/lib/site/stay-format';
import { StayMedia } from '@/components/bnb/stay-media';
import { RequestForm } from '@/components/bnb/request-form';
import { ConciergeButton } from '@/components/bnb/concierge-button';
import { StayViewTracker } from '@/components/bnb/stay-view-tracker';
import { JsonLd } from '@/components/seo/json-ld';

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

const RULES: Record<string, string> = {
  smoking: 'Smoking',
  pets: 'Pets',
  parties: 'Parties or events',
  children: 'Children',
  visitors: 'Visitors',
};

export default async function StayPage({ params }: Props) {
  const { slug } = await params;
  const stay = await getStay(slug);
  if (!stay) notFound();

  const b = stay.bnb;
  const facts = stayFacts(stay);
  const host = stayHost(stay);
  const where = stayPlace(stay);
  const ident = stay.slug ?? stay.id;
  const longStay = [
    b?.weekly_price ? `${kes(b.weekly_price)} a week` : null,
    b?.monthly_price ? `${kes(b.monthly_price)} a month` : null,
  ].filter(Boolean);
  const rules = Object.entries((b?.house_rules ?? {}) as Record<string, unknown>)
    .filter(([k, v]) => RULES[k] && typeof v === 'boolean')
    .map(([k, v]) => `${RULES[k]} ${v ? 'allowed' : 'not allowed'}`);
  const quietHours = typeof b?.house_rules?.quiet_hours === 'string' ? (b.house_rules.quiet_hours as string) : null;
  if (quietHours) rules.push(`Quiet hours ${quietHours}`);

  return (
    <article className="mx-auto max-w-6xl px-4 pb-32 pt-6 lg:pb-16">
      <StayViewTracker listingId={stay.id} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VacationRental',
          name: stay.title,
          description: stay.description,
          url: `${BNB_ORIGIN}${stayPath(stay)}`,
          image: stayImages(stay).slice(0, 6).map((i) => i.url),
          address: { '@type': 'PostalAddress', addressLocality: where, addressCountry: 'KE' },
          ...(b?.max_guests ? { occupancy: { '@type': 'QuantitativeValue', maxValue: b.max_guests } } : {}),
          amenityFeature: (stay.amenities ?? []).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
        }}
      />

      <StayMedia title={stay.title} listingId={stay.id} images={stayImages(stay)} youtubeId={stay.youtube_id} isShort={stay.is_youtube_shorts} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          <header>
            <h1 className="font-bnb-display text-3xl font-bold leading-tight tracking-tight text-bnb-ink sm:text-4xl">{stay.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-bnb-stone">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {where}
              {b?.nearby_landmark ? `, near ${b.nearby_landmark}` : ''}
            </p>
            {(stayKind(stay) || facts.length > 0) && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="At a glance">
                {[stayKind(stay), ...facts].filter(Boolean).map((f) => (
                  <li key={f} className="rounded-full border border-bnb-line bg-white px-3 py-1 text-sm text-bnb-ink">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </header>

          <section className="mt-8" aria-labelledby="price">
            <h2 id="price" className="sr-only">
              Price
            </h2>
            <p className="font-bnb-display text-2xl font-bold text-bnb-ink">
              {kes(stay.price)} <span className="text-base font-normal text-bnb-stone">a night</span>
            </p>
            {longStay.length > 0 && <p className="mt-1 text-bnb-stone">Longer stays: {longStay.join(', ')}.</p>}
            {(b?.cleaning_fee || b?.security_deposit) && (
              <p className="mt-1 text-sm text-bnb-stone">
                {[b?.cleaning_fee ? `Cleaning fee ${kes(b.cleaning_fee)}` : null, b?.security_deposit ? `refundable deposit ${kes(b.security_deposit)}` : null]
                  .filter(Boolean)
                  .join(', ')}
                .
              </p>
            )}
          </section>

          {stay.description && (
            <section className="mt-8" aria-labelledby="about">
              <h2 id="about" className="font-bnb-display text-xl font-bold text-bnb-ink">
                About this place
              </h2>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-bnb-ink/90">{stay.description}</p>
            </section>
          )}

          {(stay.amenities?.length ?? 0) > 0 && (
            <section className="mt-8" aria-labelledby="amenities">
              <h2 id="amenities" className="font-bnb-display text-xl font-bold text-bnb-ink">
                What is here
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {stay.amenities!.map((a) => (
                  <li key={a} className="border-b border-bnb-line pb-2 text-bnb-ink/90">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(b?.check_in_time || b?.check_out_time || rules.length > 0 || b?.custom_rules) && (
            <section className="mt-8" aria-labelledby="rules">
              <h2 id="rules" className="font-bnb-display text-xl font-bold text-bnb-ink">
                Arrival and house rules
              </h2>
              {(b?.check_in_time || b?.check_out_time) && (
                <p className="mt-3 flex items-center gap-2 text-bnb-ink/90">
                  <Clock className="h-4 w-4 text-bnb-stone" aria-hidden />
                  {[b?.check_in_time && `Check-in from ${b.check_in_time}`, b?.check_out_time && `check-out by ${b.check_out_time}`].filter(Boolean).join(', ')}
                </p>
              )}
              {rules.length > 0 && <p className="mt-2 text-bnb-ink/90">{rules.join('. ')}.</p>}
              {b?.custom_rules && <p className="mt-2 whitespace-pre-line text-bnb-ink/90">{b.custom_rules}</p>}
            </section>
          )}

          {host && (
            <section className="mt-8 border-t border-bnb-line pt-6" aria-labelledby="host">
              <h2 id="host" className="font-bnb-display text-xl font-bold text-bnb-ink">
                Hosted by {host}
              </h2>
              <p className="mt-2 max-w-prose text-bnb-stone">
                Requests go to the host to confirm. Questions first? Our team answers on WhatsApp and checks with the host for you.
              </p>
              <ConciergeButton className="mt-4" listing={ident} label="Ask us about this place" variant="outline" />
            </section>
          )}
        </div>

        <aside id="request" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start" aria-labelledby="request-heading">
          <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-bnb-line sm:p-6">
            <h2 id="request-heading" className="font-bnb-display text-xl font-bold text-bnb-ink">
              Request your dates
            </h2>
            <div className="mt-4">
              <RequestForm listing={ident} title={stay.title} nightly={stay.price} maxGuests={b?.max_guests} minNights={b?.min_stay_nights} />
            </div>
          </div>
        </aside>
      </div>

      {/* Phones: the price and a way to the form stay in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bnb-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="font-bnb-display text-lg font-bold text-bnb-ink">
            {kes(stay.price)} <span className="text-sm font-normal text-bnb-stone">a night</span>
          </p>
          <a href="#request" className="inline-flex min-h-11 items-center rounded-full bg-bnb-amber px-5 font-semibold text-bnb-ink hover:bg-bnb-amber-deep hover:text-white">
            Request dates
          </a>
        </div>
      </div>
    </article>
  );
}
