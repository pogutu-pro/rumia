import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BnbListingForm } from './bnb-listing-form';

export const revalidate = 0;

export default async function NewBnbListingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent || agent.status === 'suspended') redirect('/dashboard');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/bnb"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to RumiaBnB
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New BnB listing</h1>
        <p className="text-sm text-slate-500 mt-1">List your short-stay property on RumiaBnB.</p>
      </div>

      <BnbListingForm agentWhatsapp={agent.whatsapp} />
    </div>
  );
}
