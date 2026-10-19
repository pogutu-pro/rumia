import Link from 'next/link';
import Image from 'next/image';
import { BNB_NAME } from '@/lib/site/bnb';

const LINK =
  'rounded-full px-3 py-2 text-sm font-semibold text-bnb-ink/80 transition-colors hover:bg-bnb-line/60 hover:text-bnb-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-bnb-forest';

export function BnbSiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-bnb-line/70 bg-bnb-mist/90 backdrop-blur supports-[backdrop-filter]:bg-bnb-mist/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest">
          <Image src="/images/bnb/mark.svg" alt="" width={28} height={28} priority unoptimized />
          <span className="font-bnb-display text-[1.2rem] font-bold tracking-tight text-bnb-ink">{BNB_NAME}</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/stays" className={LINK}>
            Stays
          </Link>
          <Link href="/hosts" className={LINK}>
            List your place
          </Link>
        </nav>
      </div>
    </header>
  );
}
