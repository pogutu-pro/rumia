import type { Metadata } from 'next';
import Link from 'next/link';
import { getStays } from '@/lib/site/bnb-api';
import { ReelStrip } from '@/components/bnb/reel-strip';
import { StayCard } from '@/components/bnb/stay-card';
import { ConciergeButton } from '@/components/bnb/concierge-button';

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: '/' } };

const STEPS = [
  { title: 'Pick a place and your dates', body: 'Send a booking request here, or tell us what you need on WhatsApp.' },
  { title: 'The host confirms', body: 'You get a link to follow your request. Nothing is paid to us.' },
  { title: 'Stay', body: 'Pay the host as agreed. Afterwards, tell us how it went.' },
];

export default async function BnbHome() {
  const stays = await getStays();
  const withVideo = stays.filter((s) => s.youtube_id);
  const reel = withVideo.length >= 2 ? withVideo : stays;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-16">
        <h1 className="max-w-3xl font-bnb-display text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.02em] text-bnb-ink sm:text-6xl">
          Stays we have walked through, filmed and vouched for.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-bnb-stone">
          Homes, apartments and cottages around Nyeri and Mt Kenya. Watch the tour, then request your dates or ask us
          on WhatsApp.
        </p>
      </section>

      {reel.length > 0 && (
        <section aria-label="Video tours" className="mx-auto max-w-6xl px-4 pb-12">
          <ReelStrip stays={reel.slice(0, 10)} />
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="all-stays">
        <div className="flex items-end justify-between gap-4">
          <h2 id="all-stays" className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink sm:text-3xl">
            {stays.length > 0 ? 'All stays' : 'New stays are on the way'}
          </h2>
          {stays.length > 6 && (
            <Link href="/stays" className="text-sm font-semibold text-bnb-forest underline-offset-4 hover:underline">
              Search by guests and price
            </Link>
          )}
        </div>
        {stays.length > 0 ? (
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {stays.slice(0, 9).map((stay, i) => (
              <li key={stay.id}>
                <StayCard stay={stay} priority={i < 2} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-lg text-bnb-stone">
            We are visiting and filming the first places now. Tell us your dates and we will find you somewhere.
          </p>
        )}
      </section>

      <section className="bg-bnb-line/50" aria-labelledby="how">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="how" className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink sm:text-3xl">
              How booking works
            </h2>
            <p className="mt-3 text-bnb-stone">No account and no booking fee for guests.</p>
            <ConciergeButton className="mt-6" label="Ask about your dates" variant="amber" />
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t-2 border-bnb-forest pt-4">
                <span className="font-bnb-display text-3xl font-extrabold text-bnb-forest/30" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-1 font-semibold text-bnb-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-bnb-stone">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
