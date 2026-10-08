import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, MapPin, ShieldAlert } from 'lucide-react';
import { ContactActions } from '@/components/contact/contact-actions';
import { JsonLd } from '@/components/seo/json-ld';
import { BackLink } from '@/components/rumia/back-link';
import { FactLine } from '@/components/rumia/fact-line';
import { MediaGallery } from '@/components/rumia/media-gallery';
import { PropertyCard } from '@/components/rumia/property-card';
import { ReportButton } from '@/components/rumia/report-button';
import { ShareButton } from '@/components/rumia/share-button';
import { SaveButton } from '@/components/ui/save-button';
import { rumiaServer, type PropertyRead } from '@/lib/api/rumia';
import { KIND_LABEL, includedLine, ksh, pricePerPeriod, unitLabel } from '@/lib/rumia/format';
import { PropertyViewTracker } from './view-tracker';

export const revalidate = 60;

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

async function load(slug: string): Promise<PropertyRead | null> {
  const { data, response } = await rumiaServer({ revalidate: 60 }).GET('/api/v1/properties/{slug}', {
    params: { path: { slug } },
  });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Could not load property ${slug} (${response.status})`);
  return data;
}

function cheapest(p: PropertyRead) {
  const available = p.units.filter((u) => u.count_available > 0);
  return (available.length ? available : p.units).slice().sort((a, b) => a.price_amount - b.price_amount)[0];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug).catch(() => null);
  if (!p) return { title: 'Place not found | Rumia' };
  const unit = cheapest(p);
  const title = `${p.name}${p.place_name ? ` · ${p.place_name}` : ''} | Rumia`;
  const description = [
    unit ? pricePerPeriod(unit.price_amount, unit.price_period) : null,
    KIND_LABEL[p.kind],
    p.facts[0]?.text,
  ]
    .filter(Boolean)
    .join(' · ');
  const cover = p.media.find((m) => m.kind === 'image' && m.url)?.url;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/p/${p.slug}` },
    openGraph: { title, description, url: `${SITE}/p/${p.slug}`, siteName: 'Rumia', type: 'website', images: cover ? [{ url: cover }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: cover ? [cover] : undefined },
    robots: p.status === 'live' || p.status === 'stale' ? undefined : { index: false },
  };
}

function Banner({ p }: { p: PropertyRead }) {
  if (p.status === 'live') return null;
  const text =
    p.status === 'let'
      ? 'This place has been let.'
      : p.status === 'paused'
        ? 'This place is no longer available.'
        : 'Not confirmed recently. Ask before you visit.';
  const gone = p.status === 'let' || p.status === 'paused';
  return (
    <div role="status" className={`flex items-start gap-2 rounded-rum-control px-4 py-3 text-sm ${gone ? 'bg-rum-sunken text-rum-text' : 'bg-amber-50 text-rum-caution'}`}>
      {gone ? <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>
        {text} {gone && <a href="#similar" className="font-semibold underline">See similar places nearby</a>}
      </span>
    </div>
  );
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const similar = await rumiaServer({ revalidate: 120 })
    .GET('/api/v1/discovery/properties/{slug}/similar', { params: { path: { slug }, query: { limit: 6 } } })
    .then((r) => r.data?.items ?? [])
    .catch(() => []);

  const unit = cheapest(p);
  const bookable = p.status === 'live' || p.status === 'stale';
  const included = includedLine(p.included_utilities);
  const sharePrice = unit ? pricePerPeriod(unit.price_amount, unit.price_period) : '';
  const shareText = `${p.name}${p.place_name ? ` in ${p.place_name}` : ''}${sharePrice ? `, ${sharePrice}` : ''}.`;
  const rules = Object.entries(p.house_rules ?? {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number');
  const gender = p.units.find((u) => u.gender_policy !== 'any')?.gender_policy;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    name: p.name,
    url: `${SITE}/p/${p.slug}`,
    description: p.description || undefined,
    image: p.media.filter((m) => m.kind === 'image' && m.url).slice(0, 5).map((m) => m.url),
    address: { '@type': 'PostalAddress', addressLocality: p.place_name || undefined, addressCountry: 'KE' },
    ...(p.lat != null && p.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {}),
    ...(unit ? { offers: { '@type': 'Offer', price: unit.price_amount, priceCurrency: 'KES' } } : {}),
  };

  return (
    <div className="bg-rum-surface pb-28 lg:pb-12">
      <JsonLd data={schema} />
      <PropertyViewTracker propertyId={p.id} listingId={p.listing_id} />
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex items-center justify-between pt-2">
          <BackLink placeSlug={p.place_slug} placeName={p.place_name} />
          <div className="flex items-center gap-2">
            {p.listing_id && <SaveButton listingId={p.listing_id} variant="icon" />}
            <ShareButton title={p.name} text={shareText} path={`/p/${p.slug}`} listingId={p.id} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl lg:px-8">
        <MediaGallery media={p.media} name={p.name} />
      </div>

      <div className="mx-auto mt-5 grid max-w-6xl gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        <div className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">{p.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-rum-muted">
              <span>{KIND_LABEL[p.kind]}</span>
              {p.place_name && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={`/?place=${p.place_slug}`} className="underline underline-offset-2">{p.place_name}, Nyeri</Link>
                </>
              )}
              {gender && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{gender === 'women' ? 'Women only' : 'Men only'}</span>
                </>
              )}
            </p>
            <Banner p={p} />
          </header>

          {unit && (
            <section aria-label="Price" className="space-y-1">
              <p className="rum-price text-3xl font-semibold text-rum-text">{pricePerPeriod(unit.price_amount, unit.price_period)}</p>
              {unit.move_in_total && (
                <p className="rum-price text-base text-rum-text">
                  {ksh(unit.move_in_total)} to move in <span className="text-rum-muted">(rent + deposit {ksh(unit.deposit_amount)})</span>
                </p>
              )}
              {included && <p className="text-sm text-rum-muted">{included}</p>}
              {p.units.length > 1 && <p className="text-sm text-rum-muted">Cheapest of {p.units.length} room types, shown below.</p>}
            </section>
          )}

          {p.facts.length > 0 && (
            <ul aria-label="What Rumia knows" className="space-y-2">
              {p.facts.map((f) => (
                <FactLine key={f.kind + f.text} fact={f} stale={p.status === 'stale' && f.kind === 'availability'} />
              ))}
            </ul>
          )}

          {p.units.length > 1 && (
            <section aria-labelledby="units-h">
              <h2 id="units-h" className="text-lg font-semibold">Room types</h2>
              <div className="mt-2 divide-y divide-rum-line overflow-hidden rounded-rum-media border border-rum-line bg-rum-raised">
                {p.units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-base font-medium">{unitLabel(u)}</p>
                      <p className="text-sm text-rum-muted">
                        {u.count_available > 0 ? `${u.count_available} available` : 'None available now'}
                        {u.move_in_total ? ` · ${ksh(u.move_in_total)} to move in` : ''}
                      </p>
                    </div>
                    <p className="rum-price shrink-0 text-base font-semibold">{pricePerPeriod(u.price_amount, u.price_period)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="loc-h" className="space-y-2">
            <h2 id="loc-h" className="text-lg font-semibold">Location</h2>
            <p className="flex items-start gap-2 text-base">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-rum-muted" aria-hidden="true" />
              <span>
                {[p.place_name, p.address_hint].filter(Boolean).join(' · ') || 'Nyeri'}
                {p.location_precision === 'approximate' && p.lat != null && <span className="text-rum-muted"> (approximate)</span>}
              </span>
            </p>
            {p.landmarks.length > 0 && (
              <ul className="space-y-1 text-sm text-rum-muted">
                {p.landmarks.map((l) => (
                  <li key={l.slug}>{l.walk_min} min walk to {l.name}</li>
                ))}
              </ul>
            )}
            <a
              href={
                p.lat != null && p.lng != null
                  ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.place_name ?? ''} Nyeri`)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-rum-accent underline underline-offset-2"
            >
              Open in Google Maps
            </a>
          </section>

          {p.description && (
            <section aria-labelledby="about-h" className="space-y-2">
              <h2 id="about-h" className="text-lg font-semibold">About this place</h2>
              <p className="whitespace-pre-line text-base leading-relaxed text-rum-text">{p.description}</p>
            </section>
          )}

          {p.amenities.length > 0 && (
            <section aria-labelledby="have-h" className="space-y-2">
              <h2 id="have-h" className="text-lg font-semibold">What is here</h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-base">
                {p.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {rules.length > 0 && (
            <section aria-labelledby="rules-h" className="space-y-2">
              <h2 id="rules-h" className="text-lg font-semibold">Good to know</h2>
              <ul className="space-y-1 text-base">
                {rules.map(([k, v]) => (
                  <li key={k}><span className="capitalize">{k.replace(/_/g, ' ')}</span>: {String(v)}</li>
                ))}
              </ul>
            </section>
          )}

          <aside className="rounded-rum-media border border-rum-line bg-rum-raised p-4 text-sm text-rum-text">
            <p>
              <strong>Never pay a deposit before you have seen the room.</strong> Be careful if anyone rushes you to pay.{' '}
              <Link href="/help" className="font-semibold underline underline-offset-2">How to stay safe</Link>
            </p>
          </aside>

          {p.org && (
            <section aria-label="Listed by" className="text-sm text-rum-muted">
              Listed by{' '}
              <Link href={`/l/${p.org.slug}`} className="font-semibold text-rum-text underline underline-offset-2">{p.org.name}</Link>
            </section>
          )}

          <div><ReportButton slug={p.slug} /></div>
        </div>

        {/* Side card from 1024px; below that the action bar at the bottom of the screen takes over (one breakpoint). */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 rounded-rum-media border border-rum-line bg-rum-raised p-5 shadow-rum-float">
            {unit && (
              <div>
                <p className="rum-price text-2xl font-semibold">{pricePerPeriod(unit.price_amount, unit.price_period)}</p>
                {unit.move_in_total && <p className="rum-price text-sm text-rum-muted">{ksh(unit.move_in_total)} to move in</p>}
              </div>
            )}
            {bookable ? (
              <ContactActions propertyId={p.id} listingId={p.listing_id ?? undefined} title={p.name} layout="card" />
            ) : (
              <a href="#similar" className="flex min-h-12 items-center justify-center rounded-rum-control bg-rum-accent px-4 text-base font-semibold text-rum-on-accent">
                See similar places
              </a>
            )}
            <p className="text-xs text-rum-muted">Opens WhatsApp with a message already written. No account needed.</p>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section id="similar" aria-labelledby="similar-h" className="mx-auto mt-12 max-w-6xl px-4 lg:px-8">
          <h2 id="similar-h" className="text-lg font-semibold">Similar places nearby</h2>
          <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((c, i) => (
              <PropertyCard key={c.id} card={c} position={i} surface="property" />
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rum-line bg-rum-raised px-4 py-3 shadow-rum-float lg:hidden">
        {bookable ? (
          <ContactActions propertyId={p.id} listingId={p.listing_id ?? undefined} title={p.name} layout="bar" />
        ) : (
          <a href="#similar" className="flex min-h-12 items-center justify-center rounded-rum-control bg-rum-accent px-4 text-base font-semibold text-rum-on-accent">
            See similar places nearby
          </a>
        )}
      </div>
    </div>
  );
}
