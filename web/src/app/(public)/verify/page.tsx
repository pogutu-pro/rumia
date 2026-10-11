import { Metadata } from 'next';
import { SupportTeamSection } from '@/components/agents/support-team-section';
import { publicApi } from '@/lib/api/public';
import { HakisaChecker } from '@/components/agents/hakisa-checker';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Hakikisha — Verify Before You Pay',
  description:
    'Check if a hostel, phone number, or payment details are verified against official DeKUT records before sending money. Fast, free, and confidential.',
  alternates: {
    canonical: '/verify',
  },
  openGraph: {
    title: 'Hakikisha — Verify Before You Pay | Rumia',
    description:
      'Check if a hostel, phone number, or payment details are verified against official DeKUT records before sending money.',
    url: '/verify',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default async function VerifyPage() {
  const activeAgents = await publicApi.getSupportTeam({ revalidate }).catch(() => []);

  return (
    <div className="min-h-[calc(100dvh-var(--shell-header-h))] pb-10">
      <h1 className="sr-only">Verify a hostel before you pay</h1>
      <div className="container mx-auto px-4 pt-10 sm:pt-16 lg:pt-20">
        {/* Mobile: owner on top · Desktop: owner left, checker right */}
        <div className="xl:grid xl:grid-cols-[minmax(0,32rem)_minmax(0,32rem)] xl:gap-4 xl:justify-center xl:items-start">
          <div>
            <SupportTeamSection agents={activeAgents} ownerAtTop />
          </div>
          <div className="mt-10 xl:mt-0">
            <HakisaChecker />
          </div>
        </div>

        {/* Customer Support Team below the checker */}
        <SupportTeamSection agents={activeAgents} teamOnly />
      </div>
    </div>
  );
}
