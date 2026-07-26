import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LeadsTable } from '../leads-table';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentLeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) redirect('/dashboard');

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('agent_id', agent.id)
    .order('id', { ascending: false });

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('agent_id', agent.id)
    .order('clicked_at', { ascending: false });

  const totalLeads = (leads || []).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Student Leads
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {totalLeads > 0
            ? `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} across all your listings.`
            : 'Leads will appear when students view your listings.'}
        </p>
      </div>

      <LeadsTable leads={leads || []} listings={(listings as any) || []} />
    </div>
  );
}
