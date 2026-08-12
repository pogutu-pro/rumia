import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  let campuses: any[] = [];

  if (manager.context.isSuperAdmin) {
    const { data } = await supabase
      .from('campuses')
      .select('id, name, slug')
      .order('name');
    campuses = data || [];
  } else if (manager.context.managedRegionId) {
    const { data } = await supabase
      .from('campuses')
      .select('id, name, slug')
      .eq('region_id', manager.context.managedRegionId)
      .order('name');
    campuses = data || [];
  } else if (manager.context.managedCampusId) {
    const { data } = await supabase
      .from('campuses')
      .select('id, name, slug')
      .eq('id', manager.context.managedCampusId);
    campuses = data || [];
  }

  // RLS scopes rows to the campuses this manager is authorized for (active and
  // expired announcements both come back so the dashboard can show history).
  const { data: announcements } = await supabase
    .from('announcements')
    .select(
      `id, campus_id, title, message, type, created_by, created_at, updated_at, expires_at,
       campuses ( id, name, slug )`,
    )
    .order('created_at', { ascending: false });

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
