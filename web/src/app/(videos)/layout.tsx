import { AppShell } from '@/components/shell';
import { CampusProvider } from '@/lib/campus-context';
import { getDefaultCampus } from '@/lib/data/campuses';
import { RumiaChrome } from '@/components/shell/rumia-chrome';

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  const campus = await getDefaultCampus();
  return (
    <RumiaChrome>
      <CampusProvider campus={campus}>
        <AppShell>{children}</AppShell>
      </CampusProvider>
    </RumiaChrome>
  );
}
