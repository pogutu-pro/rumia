'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getSession } from '@/lib/supabase/auth';
import { ArrowRight, Lightbulb } from 'lucide-react';

const MAX_HOSTELS = 20;

export function EarlyAccessBanner() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [href, setHref] = useState('/auth/login?next=/account');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (count !== null && count < MAX_HOSTELS) {
        const { session } = await getSession();
        setHref(session ? '/account' : '/auth/login?next=/account');
        setVisible(true);
      }
      setChecking(false);
    })();
  }, []);

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
