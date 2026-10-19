import Link from 'next/link';
import { Photo } from './photo';
import { Play } from 'lucide-react';
import type { BnbStay } from '@/lib/site/bnb-api';
import { kes, stayCover, stayPath, stayPlace } from '@/lib/site/stay-format';

/**
 * The home page's signature: stays as vertical 9:16 tiles, the same shape as the TikTok and Shorts that bring guests
 * here, so the first thing they see continues what they were watching.
 */
export function ReelStrip({ stays }: { stays: BnbStay[] }) {
  if (stays.length === 0) return null;
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {stays.map((stay, i) => {
        const cover = stayCover(stay);
        return (
          <li key={stay.id} className="w-[62%] max-w-[15rem] shrink-0 snap-start sm:w-56">
            <Link
              href={stayPath(stay)}
              className="group relative block aspect-[9/16] overflow-hidden rounded-[1.5rem] bg-bnb-pine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bnb-forest"
            >
              {cover && (
                <Photo src={cover} size="gallery" alt="" sizes="240px" className="object-cover" priority={i < 2} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bnb-ink/85 via-bnb-ink/10 to-transparent" aria-hidden />
              {stay.youtube_id && (
                <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-bnb-ink" aria-hidden>
                  <Play className="h-4 w-4 translate-x-px fill-current" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="font-bnb-display text-xl font-bold leading-tight">{stay.title}</p>
                <p className="mt-1 text-sm text-white/80">{stayPlace(stay)}</p>
                <p className="mt-2 text-sm font-semibold text-bnb-amber">{kes(stay.price)} a night</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
