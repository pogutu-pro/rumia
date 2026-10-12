import { AppShell } from '@/components/shell';
import { CampusProvider } from '@/lib/campus-context';
import { getDefaultCampus } from '@/lib/data/campuses';

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  const campus = await getDefaultCampus();
  return (
    <CampusProvider campus={campus}>
      <AppShell>{children}</AppShell>
    </CampusProvider>
  );
}
