import Link from 'next/link';
import { BnbLogo } from './site-header';

const RUMIA_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rumia.co.ke').replace(/\/+$/, '');

const COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  { title: 'Guests', links: [['Find a stay', '/stays'], ['Video tours', '/stays?type=video'], ['Weekly and monthly stays', '/stays?type=long']] },
  { title: 'Hosts', links: [['List your place', '/hosts'], ['Host sign-in', '/host']] },
  { title: 'Rumia', links: [['Hostels and monthly rentals', RUMIA_ORIGIN], ['Terms', `${RUMIA_ORIGIN}/terms`], ['Privacy', `${RUMIA_ORIGIN}/policy`]] },
];

export function BnbSiteFooter() {
  return (
    <footer className="mt-auto border-t border-bnb-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-6">
        <div>
          <BnbLogo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-bnb-stone">Short stays around Mt Kenya, from Rumia. Real places, the full price up front, people you can talk to.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold text-bnb-ink">{c.title}</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-bnb-stone">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-bnb-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-bnb-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-bnb-stone md:px-6">© {new Date().getFullYear()} Rumia. RumiaBnB is part of Rumia.</p>
      </div>
    </footer>
  );
}
