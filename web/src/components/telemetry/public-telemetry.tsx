'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getDeviceId } from '@/lib/device';
import { trackSessionStart, type Surface } from '@/lib/events';
import { ContactFollowUp } from '@/components/contact/contact-follow-up';

function surfaceFor(pathname: string): Surface {
  if (pathname === '/' || pathname === '/explore') return 'explore';
  if (pathname.startsWith('/p/') || pathname.startsWith('/hostels/') || pathname.startsWith('/bnb/')) return 'property';
  if (pathname.startsWith('/saved')) return 'saved';
  if (pathname.startsWith('/check') || pathname.startsWith('/verify')) return 'check';
  return 'other';
}

/** Gives the browser its anonymous device id, records where the visit started, and mounts the reply prompt. */
export function PublicTelemetry() {
  const pathname = usePathname();
  useEffect(() => {
    getDeviceId();
    trackSessionStart(surfaceFor(pathname), 'nyeri');
    // Only the first page of a visit starts a session; later navigations are no-ops.
  }, [pathname]);
  return <ContactFollowUp />;
}
