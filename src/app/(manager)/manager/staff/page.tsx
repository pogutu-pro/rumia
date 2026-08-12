import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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

  const supabase = await createClient();

  // Fetch all staff members (manager, admin)
  const { data: staffProfiles } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      full_name,
      role,
      managed_campus_id,
      managed_region_id
    `)
    .in('role', ['manager', 'admin'])
    .order('created_at', { ascending: false });

  // Fetch emails from auth.users (requires admin)
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  
  const staff = (staffProfiles || []).map(profile => {
    const authUser = users.find(u => u.id === profile.id);
    return {
      ...profile,
      email: authUser?.email || 'Unknown',
    };
  });

  const { data: campuses } = await supabaseAdmin.from('campuses').select('id, name').order('name');
  const { data: regions } = await supabaseAdmin.from('regions').select('id, name').order('name');

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
        campuses={campuses || []} 
        regions={regions || []} 
      />
    </div>
  );
}
