import Link from 'next/link';
import { DiscoveryCard } from './search-card';
import { AlertButton } from './alert-button';
import type { SearchCard } from '@/lib/api/rumia';

interface LandingProps {
  title: string;
  intro: string;
  cards: SearchCard[];
  /** The filters that describe this page, so "Notify me" can watch for new places that match. */
  alert?: { intent: Record<string, unknown>; label: string };
  related?: Array<{ href: string; label: string }>;
  relatedTitle?: string;
  children?: React.ReactNode;
}

/** Shared layout for pages about one area or one landmark, in the site's existing style. */
export function DiscoveryLanding({ title, intro, cards, alert, related = [], relatedTitle = 'Nearby', children }: LandingProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{intro}</p>
        </div>
        {alert && <AlertButton intent={alert.intent} label={alert.label} />}
      </header>
      {children}
      {cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="font-semibold text-slate-900">Nothing listed here right now</p>
          <p className="mt-1 text-sm text-slate-500">Use Notify me and we will tell you when a place appears.</p>
          <Link href="/hostels" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white">
            Browse all places
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          {cards.map((c) => (
            <DiscoveryCard key={c.id} card={c} />
          ))}
        </div>
      )}
      {related.length > 0 && (
        <nav aria-label={relatedTitle} className="mt-12">
          <h2 className="text-sm font-bold text-slate-900">{relatedTitle}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-700 hover:border-slate-300">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
