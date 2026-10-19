import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getStays } from '@/lib/site/bnb-api';
import { stayPlace } from '@/lib/site/stay-format';
import { SearchBar } from './search/search-bar';
import { HostMenu } from './host-menu';

/** Rumia's mark and type with "BnB", so the two products read as one family. */
export function BnbLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <Image src="/images/logo/logo-icon.svg" alt="" width={30} height={30} priority unoptimized className="h-8 w-8" />
      <span className={compact ? 'hidden lg:flex lg:items-baseline' : 'flex items-baseline'}>
        <span className="font-bnb-display text-xl font-extrabold tracking-tight text-bnb-ink">Rumia</span>
        <span className="ml-1 rounded-md bg-bnb-forest px-1.5 py-0.5 font-bnb-display text-xs font-extrabold tracking-wide text-white">BnB</span>
      </span>
    </span>
  );
}

export async function BnbSiteHeader() {
  const places = [...new Set((await getStays()).map(stayPlace))].sort();
  return (
    <header className="sticky top-0 z-40 border-b border-bnb-line/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 md:px-6 md:py-4">
        <Link href="/" aria-label="RumiaBnB home" className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest">
          <BnbLogo compact />
        </Link>
        <div className="min-w-0 flex-1 md:w-[min(40rem,52vw)]">
          <Suspense fallback={<div className="h-12 rounded-full border border-bnb-line bg-white" />}>
            <SearchBar places={places} />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Link href="/hosts" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-bnb-ink hover:bg-bnb-mist lg:block">
            List your place
          </Link>
          <HostMenu />
        </div>
      </div>
    </header>
  );
}
