import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
import { PaymentsCard } from '../payments-card';

export const metadata = {
  title: 'Payments & Fees - Manager',
};

export default async function ManagerPaymentsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const supabase = await createClient();
  let campuses = [];

  if (manager.context.isSuperAdmin) {
    const { data } = await supabase.from('campuses').select('*').order('name');
    campuses = data || [];
  } else if (manager.context.managedRegionId) {
    const { data } = await supabase
      .from('campuses')
      .select('*')
      .eq('region_id', manager.context.managedRegionId)
      .order('name');
    campuses = data || [];
  } else if (manager.context.managedCampusId) {
    const { data } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', manager.context.managedCampusId);
    campuses = data || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Payments & Fees
        </h1>
        <p className="text-sm text-slate-500">
          Set the hostel-finding and agent consultation fees for your campus.
        </p>
      </div>

      <PaymentsCard
        campuses={campuses as any[]}
        isSuperAdmin={manager.context.isSuperAdmin}
      />
    </div>
  );
}