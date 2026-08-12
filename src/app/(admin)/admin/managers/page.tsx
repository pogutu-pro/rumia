import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdminUser } from '@/lib/utils/admin';
import { redirect } from 'next/navigation';
import ManagersTableClient from './managers-table-client';

export const metadata = {
  title: 'Managers Management | Admin',
};

export default async function ManagersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const isAdmin = await isAdminUser(supabase, user.id);
  if (!isAdmin) {
    redirect('/auth/login');
  }

  // Fetch managers
  const { data: managers, error: managersError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, managed_campus_id, managed_region_id, campuses:managed_campus_id(id, name), regions:managed_region_id(id, name)')
    .in('role', ['manager'])
    .order('full_name');

  // Fetch campuses and regions for the form
  const { data: campuses } = await supabaseAdmin.from('campuses').select('id, name').order('name');
  const { data: regions } = await supabaseAdmin.from('regions').select('id, name').order('name');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Managers</h1>
          <p className="text-sm text-slate-500 mt-1">Assign and manage campus and region managers.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <ManagersTableClient 
          initialManagers={managers || []} 
          campuses={campuses || []} 
          regions={regions || []} 
        />
      </div>
    </div>
  );
}
