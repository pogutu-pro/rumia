import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { BadgeCheck, MessageCircle, ReceiptText } from 'lucide-react';
import { getStays } from '@/lib/site/bnb-api';
import { ReelStrip } from '@/components/bnb/reel-strip';
import { StayCard } from '@/components/bnb/stay-card';
import { CategoryBar } from '@/components/bnb/category-bar';
import { ConciergeButton } from '@/components/bnb/concierge-button';

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: '/' } };

const PROMISES = [
  { icon: BadgeCheck, title: 'Visited and filmed by us', body: 'Every place is seen by our team before it goes up, so the photos and the tour are the real thing.' },
  { icon: ReceiptText, title: 'The full price up front', body: 'Pick your dates and you see the total, cleaning fee included. No surprise at checkout.' },
  { icon: MessageCircle, title: 'People, not a call centre', body: 'Ask us anything on WhatsApp. We check with the host and come back to you.' },
];

export default async function BnbHome() {
  const stays = await getStays();
  const withVideo = stays.filter((s) => s.youtube_id);
  const towns = [...new Set(stays.map((s) => (s.county ?? '').trim()).filter(Boolean))];
  const where = towns.length === 1 ? towns[0].replace(/^\w/, (c) => c.toUpperCase()) : 'Mt Kenya';

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6">
        <Suspense fallback={<div className="h-16" />}>
          <CategoryBar base="/" />
        </Suspense>
      </div>

      {withVideo.length > 0 && (
        <section aria-labelledby="tours" className="mx-auto max-w-7xl px-4 pb-4 pt-8 md:px-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="tours" className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink">
                Walk through before you book
              </h2>
              <p className="mt-1 text-bnb-stone">Short video tours, filmed on our visits.</p>
            </div>
            <Link href="/stays?type=video" className="hidden text-sm font-semibold text-bnb-ink underline underline-offset-4 sm:block">
              All video tours
            </Link>
          </div>
          <ReelStrip stays={withVideo.slice(0, 10)} />
        </section>
      )}

      <section aria-labelledby="stays" className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6">
        <h2 id="stays" className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink">
          {stays.length > 0 ? `Stays around ${where}` : 'New stays are on the way'}
        </h2>
        {stays.length > 0 ? (
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stays.map((stay, i) => (
              <li key={stay.id}>
                <StayCard stay={stay} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 max-w-lg">
            <p className="text-bnb-stone">We are visiting and filming the first places now. Tell us your dates and we will find you somewhere.</p>
            <ConciergeButton className="mt-5" label="Ask us on WhatsApp" />
          </div>
        )}
      </section>

      <section aria-labelledby="why" className="border-t border-bnb-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <h2 id="why" className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink">
            Why book with RumiaBnB
          </h2>
          <ul className="mt-8 grid gap-8 md:grid-cols-3">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bnb-forest/10 text-bnb-forest">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-bnb-ink">{title}</h3>
                <p className="mt-1.5 max-w-sm leading-relaxed text-bnb-stone">{body}</p>
              </li>
            ))}
          </ul>
          <ConciergeButton className="mt-10" label="Ask about your dates" variant="outline" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid items-center gap-6 overflow-hidden rounded-[2rem] bg-bnb-ink p-8 text-white md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <h2 className="font-bnb-display text-3xl font-bold tracking-tight">Have a place guests would love?</h2>
            <p className="mt-3 max-w-lg text-white/75">We film it, put it in front of travellers on TikTok, Instagram and YouTube, and send you booking requests. You pay only for stays that happen.</p>
          </div>
          <div className="md:text-right">
            <Link href="/hosts" className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-semibold text-bnb-ink hover:bg-bnb-mist">
              List your place
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
