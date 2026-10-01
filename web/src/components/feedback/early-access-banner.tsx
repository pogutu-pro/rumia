'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listingsClientApi } from '@/lib/api/listings-client';
import { getSession } from '@/lib/supabase/auth';
import { ArrowRight, Lightbulb } from 'lucide-react';

const MAX_HOSTELS = 20;

interface EarlyAccessBannerProps {
  /** Active listing count supplied by the server (avoids a client-side query). */
  hostelCount?: number;
}

export function EarlyAccessBanner({ hostelCount }: EarlyAccessBannerProps) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(hostelCount === undefined);
  const [href, setHref] = useState('/auth/login?next=/account');

  useEffect(() => {
    if (hostelCount !== undefined) {
      if (hostelCount < MAX_HOSTELS) {
        (async () => {
          const { session } = await getSession();
          setHref(session ? '/account' : '/auth/login?next=/account');
          setVisible(true);
        })();
      }
      return;
    }

    (async () => {
      // Active listing total (limit 1: only the count is needed).
      const count = await listingsClientApi
        .getFeed({ limit: 1 })
        .then((res) => res.total)
        .catch(() => null);

      if (count !== null && count < MAX_HOSTELS) {
        const { session } = await getSession();
        setHref(session ? '/account' : '/auth/login?next=/account');
        setVisible(true);
      }
      setChecking(false);
    })();
  }, [hostelCount]);

  if (checking || !visible) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/60 border border-emerald-200 rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            More hostels will be added. Got a suggestion?
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            We&apos;re growing, tell us what you&apos;d like to see next.
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm whitespace-nowrap"
      >
        Give Feedback
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
