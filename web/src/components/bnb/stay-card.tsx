import Link from 'next/link';
import Image from 'next/image';
import { Play } from 'lucide-react';
import type { BnbStay } from '@/lib/site/bnb-api';
import { kes, stayCover, stayFacts, stayPath, stayPlace } from '@/lib/site/stay-format';

/** A stay in a list: the photo carries it; name, place and the nightly price underneath. */
export function StayCard({ stay, priority = false }: { stay: BnbStay; priority?: boolean }) {
  const cover = stayCover(stay);
  const facts = stayFacts(stay).slice(0, 2).join(', ');
  return (
    <Link
      href={stayPath(stay)}
      className="group block rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-bnb-line">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            priority={priority}
          />
        )}
        {stay.youtube_id && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-bnb-ink/75 px-2.5 py-1 text-xs font-semibold text-white">
            <Play className="h-3 w-3 fill-current" aria-hidden />
            Video tour
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bnb-display text-lg font-bold leading-tight text-bnb-ink">{stay.title}</h3>
          <p className="mt-0.5 truncate text-sm text-bnb-stone">{stayPlace(stay)}</p>
          {facts && <p className="mt-0.5 text-sm text-bnb-stone">{facts}</p>}
        </div>
        <p className="shrink-0 text-right text-sm text-bnb-stone">
          <span className="block font-bnb-display text-lg font-bold text-bnb-ink">{kes(stay.price)}</span>a night
        </p>
      </div>
    </Link>
  );
}
