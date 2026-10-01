import { getManagerUser } from '@/app/actions/manager';
import { managerApi } from '@/lib/api/manager';
import { regionsApi } from '@/lib/api/regions';
import { StaffClient } from './staff-client';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Staff Management - Manager',
};

export default async function ManagerStaffPage() {
  const manager = await getManagerUser();

  if (!manager || !manager.context.isSuperAdmin) {
    // Only super admins can access the staff page
    redirect('/manager');
  }

  const [staffRows, campuses, regions] = await Promise.all([
    managerApi.staff().catch(() => []),
    managerApi.campuses().catch(() => []),
    regionsApi.listServer().catch(() => []),
  ]);
  const staff = staffRows.map((m) => ({
    ...m,
    full_name: m.full_name ?? '',
    email: m.email || 'Unknown',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Staff Management
        </h1>
        <p className="text-sm text-slate-500">
          Assign manager roles, set access scopes (campus vs region), and manage admins.
        </p>
      </div>

      <StaffClient 
        staff={staff} 
        campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
      />
    </div>
  );
}
