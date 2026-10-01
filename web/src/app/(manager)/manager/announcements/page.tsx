import { getManagerUser } from '@/app/actions/manager';
import { managerApi } from '@/lib/api/manager';
import { announcementsApi } from '@/lib/api/announcements';
import { AnnouncementsClient } from './announcements-client';

export const metadata = {
  title: 'Announcements - Manager',
};

export default async function ManagerAnnouncementsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const [campusRows, announcementRows] = await Promise.all([
    managerApi.campuses().catch(() => []),
    announcementsApi.listManagedServer().catch(() => []),
  ]);
  const campuses = campusRows.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
  // The client reads the embedded campus as `campuses` (legacy shape).
  const announcements = announcementRows.map(({ campus, ...rest }) => ({
    ...rest,
    campuses: campus ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Announcements
        </h1>
        <p className="text-sm text-slate-500">
          Publish important updates that appear at the top of the public site.
          Announcements expire automatically on the date you set.
        </p>
      </div>

      <AnnouncementsClient
        campuses={campuses}
        isSuperAdmin={manager.context.isSuperAdmin}
        initialAnnouncements={(announcements || []) as any[]}
      />
    </div>
  );
}
