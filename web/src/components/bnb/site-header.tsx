import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle } from 'lucide-react';
import { BNB_NAME, conciergeUrl } from '@/lib/site/bnb';

export function BnbSiteHeader() {
  const chat = conciergeUrl(`Hi ${BNB_NAME}, I'm looking for a place to stay.`);
  return (
    <header className="sticky top-0 z-40 border-b border-bnb-line/70 bg-bnb-mist/90 backdrop-blur supports-[backdrop-filter]:bg-bnb-mist/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest">
          <Image src="/images/bnb/mark.svg" alt="" width={28} height={28} priority unoptimized />
          <span className="font-bnb-display text-[1.2rem] font-bold tracking-tight text-bnb-ink">{BNB_NAME}</span>
        </Link>
        {chat && (
          <a
            href={chat}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-bnb-forest px-4 text-sm font-semibold text-bnb-mist transition-colors hover:bg-bnb-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bnb-amber"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Chat with us
          </a>
        )}
      </div>
    </header>
  );
}
