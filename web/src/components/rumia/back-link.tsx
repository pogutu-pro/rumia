'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ArrowLeft } from 'lucide-react';

const subscribeNever = () => () => {};

function readCameFromExplore(): boolean {
  if (!document.referrer) return false;
  try {
    const ref = new URL(document.referrer);
    return ref.host === window.location.host && (ref.pathname === '/' || ref.pathname.startsWith('/saved'));
  } catch {
    return false;
  }
}

/**
 * "Back to results" when the visitor came from Rumia's own Explore (keeps their scroll position),
 * otherwise "More places in {area}" so a single shared link leads into a search instead of a dead end.
 */
export function BackLink({ placeSlug, placeName }: { placeSlug?: string | null; placeName?: string | null }) {
  const router = useRouter();
  // Read on the client only; the server renders the neutral link, so there is no hydration mismatch.
  const cameFromExplore = useSyncExternalStore(subscribeNever, readCameFromExplore, () => false);

  const cls = 'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-rum-text hover:underline';
  if (cameFromExplore) {
    return (
      <button type="button" onClick={() => router.back()} className={cls}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to results
      </button>
    );
  }
  return (
    <Link href={placeSlug ? `/?place=${placeSlug}` : '/'} className={cls}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {placeName ? `More places in ${placeName}` : 'More places'}
    </Link>
  );
}
