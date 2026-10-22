import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { WelcomeForm } from '@/components/auth/welcome-form';
import { campusesServerApi } from '@/lib/api/campuses.server';
import { profilesServerApi } from '@/lib/api/profiles.server';
import { safeNext } from '@/lib/auth/origin';
import { missingSetup } from '@/lib/auth/onboarding';

export const metadata: Metadata = {
  title: 'Finish setting up',
  robots: { index: false },
};

/**
 * First-time setup after sign-in: only the details a student still lacks, on one short page they can skip.
 * Anything unexpected sends them on to where they were going; this page must never be the thing that blocks them.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const next = safeNext((await searchParams).next);

  const profile = await profilesServerApi.getMeServer().catch(() => null);
  if (!profile) redirect(next);
  const missing = missingSetup(profile);
  if (!missing.required) redirect(next);

  const campuses = missing.campus
    ? ((await campusesServerApi.listServer('active,coming_soon').catch(() => [])) ?? [])
    : [];

  return (
    <WelcomeForm
      next={next}
      firstName={profile.full_name?.trim().split(/\s+/)[0] ?? null}
      askName={missing.name}
      askPhone={missing.phone}
      askCampus={missing.campus}
      currentCampusName={profile.home_campus_name ?? null}
      campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
