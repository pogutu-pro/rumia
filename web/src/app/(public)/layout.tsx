import { ReactNode } from 'react';
import { AppShell } from '@/components/shell';
import { HomeVideoDrawer } from '@/components/videos/video-drawer';
import { Footer } from '@/components/layouts/public-footer';
import { getCampusBySlug } from '@/lib/data/campuses';
import { ContactFollowUp } from '@/components/contact/contact-follow-up';
import { CampusProvider } from '@/lib/campus-context';

interface LayoutProps {
  children: ReactNode;
}

export default async function PublicLayout({ children }: LayoutProps) {
  const campus = await getCampusBySlug('dekut');

  return (
    <CampusProvider campus={campus}>
      <AppShell rightPanel={<HomeVideoDrawer />}>
        <div className="flex min-h-[calc(100dvh-var(--shell-header-h))] flex-col">
          <div className="flex-1">{children}</div>
          <Footer whatsappNumber={campus.whatsapp_number} />
        </div>
        <ContactFollowUp />
      </AppShell>
    </CampusProvider>
  );
}
