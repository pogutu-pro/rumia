import { ReactNode } from 'react';
import { PublicHeader } from '@/components/layouts/public-header';
import { Footer } from '@/components/layouts/public-footer';
import { getCampusBySlug, getAllCampuses } from '@/lib/data/campuses';
import { CampusProvider } from '@/lib/campus-context';

interface LayoutProps {
  children: ReactNode;
}

export default async function PublicLayout({ children }: LayoutProps) {
  const [campus, campuses] = await Promise.all([
    getCampusBySlug('dekut'),
    getAllCampuses(),
  ]);

  return (
    <CampusProvider campus={campus}>
      <div className="flex min-h-screen flex-col">
        <PublicHeader campuses={campuses} />
        <main className="flex-1">{children}</main>
        <Footer whatsappNumber={campus.whatsapp_number} />
      </div>
    </CampusProvider>
  );
}
