import Link from 'next/link';
import { BNB_NAME } from '@/lib/site/bnb';

const RUMIA_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rumia.co.ke').replace(/\/+$/, '');

export function BnbSiteFooter() {
  return (
    <footer className="mt-auto bg-bnb-forest text-bnb-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-sm">
          <p className="font-bnb-display text-2xl font-bold tracking-tight">{BNB_NAME}</p>
          <p className="mt-2 text-sm leading-relaxed text-bnb-mist/75">
            Short stays around Mt Kenya and beyond, picked and filmed by our team.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-bnb-mist/80">
          <Link href={`${RUMIA_ORIGIN}/terms`} className="hover:text-bnb-amber">Terms</Link>
          <Link href={`${RUMIA_ORIGIN}/policy`} className="hover:text-bnb-amber">Privacy</Link>
          <Link href={RUMIA_ORIGIN} className="hover:text-bnb-amber">Hostels and rentals on Rumia</Link>
        </nav>
      </div>
    </footer>
  );
}
