import type { Metadata } from 'next';
import Link from 'next/link';
import { getStays, type BnbStay } from '@/lib/site/bnb-api';
import { StayCard } from '@/components/bnb/stay-card';
import { ConciergeButton } from '@/components/bnb/concierge-button';
import { stayPlace } from '@/lib/site/stay-format';

export const metadata: Metadata = {
  title: 'Find a stay',
  description: 'Short stays around Nyeri and Mt Kenya by place, guests and price per night.',
  alternates: { canonical: '/stays' },
};

interface Filters {
  where: string;
  guests: number;
  max: number;
}

function parse(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  return {
    where: one('where').trim().toLowerCase(),
    guests: Math.max(0, Math.min(50, parseInt(one('guests'), 10) || 0)),
    max: Math.max(0, parseInt(one('max'), 10) || 0),
  };
}

function matches(stay: BnbStay, f: Filters): boolean {
  if (f.where && !`${stay.area ?? ''} ${stay.county ?? ''} ${stay.location}`.toLowerCase().includes(f.where)) return false;
  if (f.guests && (stay.bnb?.max_guests ?? 0) > 0 && (stay.bnb?.max_guests ?? 0) < f.guests) return false;
  if (f.max && stay.price > f.max) return false;
  return true;
}

const FIELD =
  'h-12 w-full rounded-xl border border-bnb-line bg-white px-3 text-base text-bnb-ink focus:border-bnb-forest focus:outline-none focus:ring-2 focus:ring-bnb-forest/20';

export default async function StaysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const all = await getStays();
  const f = parse(await searchParams);
  const stays = all.filter((s) => matches(s, f));
  const places = [...new Set(all.map((s) => stayPlace(s)))].sort();
  const filtered = !!(f.where || f.guests || f.max);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <h1 className="font-bnb-display text-3xl font-bold tracking-tight text-bnb-ink sm:text-4xl">Find a stay</h1>

      <form method="get" className="mt-6 grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_1px_0_rgba(16,32,26,0.06)] ring-1 ring-bnb-line sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <label className="block text-sm font-medium text-bnb-stone">
          Where
          <input name="where" defaultValue={f.where} list="bnb-places" placeholder="Nyeri, Kamakwa…" className={`mt-1 ${FIELD}`} />
          <datalist id="bnb-places">
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-bnb-stone">
          Guests
          <select name="guests" defaultValue={f.guests || ''} className={`mt-1 ${FIELD}`}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-bnb-stone">
          Up to (KSh a night)
          <input name="max" type="number" inputMode="numeric" min={0} step={500} defaultValue={f.max || ''} className={`mt-1 ${FIELD}`} />
        </label>
        <button type="submit" className="h-12 rounded-xl bg-bnb-forest px-6 font-semibold text-bnb-mist hover:bg-bnb-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-amber">
          Search
        </button>
      </form>

      <p className="mt-6 text-sm text-bnb-stone" aria-live="polite">
        {stays.length === 1 ? '1 stay' : `${stays.length} stays`}
        {filtered && (
          <>
            {' '}
            match.{' '}
            <Link href="/stays" className="font-semibold text-bnb-forest underline-offset-4 hover:underline">
              Clear search
            </Link>
          </>
        )}
      </p>

      {stays.length > 0 ? (
        <ul className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {stays.map((stay, i) => (
            <li key={stay.id}>
              <StayCard stay={stay} priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 max-w-lg">
          <p className="text-bnb-ink">Nothing matches yet. Tell us your dates and how many you are, and we will look for you.</p>
          <ConciergeButton className="mt-4" label="Ask us on WhatsApp" />
        </div>
      )}
    </div>
  );
}
