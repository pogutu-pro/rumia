import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { EnquiriesSection } from '@/components/dashboard/enquiries-section';
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

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  const [apiListings, leadsPage] = await Promise.all([
    agentDashboardApi.listings().catch(() => []),
    agentDashboardApi.leads().catch(() => ({ items: [], total: 0 })),
  ]);
  const listings = apiListings.map((l) => ({ id: l.id, title: l.title }));
  const leads = leadsPage.items;

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

      <EnquiriesSection />

      <LeadsTable leads={leads || []} listings={(listings as any) || []} />
    </div>
  );
}
