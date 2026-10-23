import { getLiveMarkets } from '@/lib/seo/markets';
import { ReactNode } from 'react';
import { AppShell } from '@/components/shell';
import { HomeVideoDrawer } from '@/components/videos/video-drawer';
import { Footer } from '@/components/layouts/public-footer';
import { getDefaultCampus } from '@/lib/data/campuses';
import { ContactFollowUp } from '@/components/contact/contact-follow-up';
import { CampusProvider } from '@/lib/campus-context';
import { RumiaChrome } from '@/components/shell/rumia-chrome';
import { publicApi } from '@/lib/api/public';

interface LayoutProps {
  children: ReactNode;
}

export default async function PublicLayout({ children }: LayoutProps) {
  const campus = await getDefaultCampus();
  const markets = await getLiveMarkets();
  // Cached for a day like the /verify page: the owner line in the footer costs no extra request per visit.
  const owner = await publicApi
    .getSupportTeam({ revalidate: 86400 })
    .then((team) => team.find((a) => a.is_owner && a.whatsapp) ?? null)
    .catch(() => null);

  return (
    <RumiaChrome>
      <CampusProvider campus={campus}>
        <AppShell rightPanel={<HomeVideoDrawer />}>
          <div className="flex min-h-[calc(100dvh-var(--shell-header-h))] flex-col">
            <div className="flex-1">{children}</div>
            <Footer whatsappNumber={campus.whatsapp_number} markets={markets} owner={owner} />
          </div>
          <ContactFollowUp />
        </AppShell>
      </CampusProvider>
    </RumiaChrome>
  );
}
