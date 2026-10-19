import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { getStays } from '@/lib/site/bnb-api';
import { StayCard } from '@/components/bnb/stay-card';
import { CategoryBar } from '@/components/bnb/category-bar';
import { ConciergeButton } from '@/components/bnb/concierge-button';
import { matchesSearch, nightsBetween, parseSearch, shortRange } from '@/lib/site/stay-search';

export const metadata: Metadata = {
  title: 'Find a stay',
  description: 'Short stays around Nyeri and Mt Kenya by place, dates and guests, with the full price for your dates.',
  alternates: { canonical: '/stays' },
};

export default async function StaysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [all, sp] = await Promise.all([getStays(), searchParams]);
  const search = parseSearch(sp);
  const stays = all.filter((s) => matchesSearch(s, search));
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const parts = [
    search.where && `in ${search.where}`,
    search.checkIn && search.checkOut && shortRange(search.checkIn, search.checkOut),
    search.guests && `${search.guests} guest${search.guests === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 md:px-6">
      <Suspense fallback={<div className="h-16" />}>
        <CategoryBar />
      </Suspense>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-bnb-display text-2xl font-bold tracking-tight text-bnb-ink">
          {stays.length === 1 ? '1 stay' : `${stays.length} stays`}
          {parts.length > 0 && <span className="font-normal text-bnb-stone"> {parts.join(', ')}</span>}
        </h1>
        {parts.length > 0 && (
          <Link href="/stays" className="inline-flex min-h-11 items-center text-sm font-semibold text-bnb-ink underline underline-offset-4">
            Clear search
          </Link>
        )}
      </div>
      {nights > 0 && stays.length > 0 && <p className="mt-1 text-sm text-bnb-stone">Prices are totals for {nights} {nights === 1 ? 'night' : 'nights'}, cleaning fee included.</p>}

      {stays.length > 0 ? (
        <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stays.map((stay, i) => (
            <li key={stay.id}>
              <StayCard stay={stay} search={search} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto mt-16 max-w-md text-center">
          <h2 className="font-bnb-display text-xl font-bold text-bnb-ink">No exact matches</h2>
          <p className="mt-2 text-bnb-stone">Try other dates or fewer filters, or tell us what you need and we will look for you.</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <ConciergeButton label="Ask us on WhatsApp" />
            <Link href="/stays" className="text-sm font-semibold text-bnb-ink underline underline-offset-4">
              See all stays
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
