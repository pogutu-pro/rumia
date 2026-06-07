import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminDashboard } from './admin-dashboard';

export const revalidate = 0; // Live data always

export default async function AdminPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Authorize Paul the administrator
  const email = user.email || '';
  const isAdmin = email.toLowerCase().includes('admin') || email.toLowerCase() === 'paul@rumia.co.ke';

  if (!isAdmin) {
    redirect('/dashboard');
  }

  // Fetch agents
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .order('name');

  // Fetch leads
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id,
      clicked_at,
      ip_hash,
      listings (
        title
      ),
      agents (
        name
      )
    `)
    .order('clicked_at', { ascending: false });

  // Fetch commissions
  const { data: commissions } = await supabase
    .from('commissions')
    .select(`
      id,
      amount,
      status,
      agent_id,
      listings (
        title
      ),
      agents (
        name
      )
    `)
    .order('id', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Admin Control Center
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Monitor agent listings, view unique lead attribution events, and manage pending commission payouts.
        </p>
      </div>

      <AdminDashboard
        initialAgents={agents as any || []}
        initialCommissions={commissions as any || []}
        initialLeads={leads as any || []}
      />
    </div>
  );
}
