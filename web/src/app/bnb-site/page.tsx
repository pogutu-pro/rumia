import type { Metadata } from 'next';
import { conciergeUrl } from '@/lib/site/bnb';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function BnbHome() {
  const chat = conciergeUrl("Hi RumiaBnB, I'm looking for a place to stay. My dates are: ");
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
      <h1 className="max-w-3xl font-bnb-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.02em] text-bnb-ink sm:text-6xl">
        Stays we have walked through, filmed and vouched for.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-bnb-stone">
        Homes, apartments and cottages around Nyeri and Mt Kenya. Tell us your dates and we will find the place and
        confirm it with the host.
      </p>
      {chat && (
        <a
          href={chat}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-bnb-amber px-6 font-semibold text-bnb-ink transition-colors hover:bg-bnb-amber-deep hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-forest"
        >
          Ask about your dates on WhatsApp
        </a>
      )}
    </section>
  );
}
