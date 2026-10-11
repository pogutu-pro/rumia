'use client';

import * as React from 'react';
import { useShell } from '@/components/shell';

interface HomeHeadingProps {
  /** Campus the listings are near; kept as screen-reader text for search engines and assistive tech. */
  campusName: string;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Greeting and page title at the top of Home.
 * The greeting follows the visitor's own clock, so it is only drawn after mount (the server cannot know the hour).
 * It names the person only when they are signed in with a name on their profile; everyone else gets a plain greeting.
 */
export function HomeHeading({ campusName }: HomeHeadingProps) {
  const { auth } = useShell();
  const greeting = React.useSyncExternalStore(
    () => () => {},
    () => greetingFor(new Date().getHours()),
    () => '',
  );

  const firstName =
    auth.status === 'signed-in' ? (auth.user.fullName ?? '').trim().split(/\s+/)[0] : '';
  // Wait for the sign-in check so the name does not pop in after the greeting.
  const ready = greeting !== '' && auth.status !== 'loading';

  return (
    <div className="px-4 pt-6 lg:px-8">
      <p className="min-h-6 text-sm text-ink-muted" aria-live="polite">
        {ready && (
          <>
            {greeting}
            {firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
          </>
        )}
      </p>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        Find your next place
        <span className="sr-only"> — student accommodation, hostels, bedsitters and apartments near {campusName}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
        Student hostels, apartments and short stays near you. Real places, real people, better living.
      </p>
    </div>
  );
}
