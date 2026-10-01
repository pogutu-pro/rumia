import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Plus, Edit, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { BnbListingsClient } from './bnb-listings-client';

export const revalidate = 0;

export default async function BnbDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent || agent.status === 'suspended') redirect('/dashboard');

  const apiListings = await agentDashboardApi.listings('short_stay').catch(() => []);
  // The list reads the legacy `listing_images` key.
  const listings = apiListings.map((l) => ({ ...l, listing_images: l.images }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">RumiaBnB</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Short stays
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {listings?.length
              ? `${listings.filter((l: any) => l.is_active).length} active listing${listings.filter((l: any) => l.is_active).length !== 1 ? 's' : ''}`
              : 'List your short-stay property and reach guests across Kenya.'}
          </p>
        </div>
        <Link href="/dashboard/bnb/new"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm self-start sm:self-auto">
          <Plus className="h-3.5 w-3.5" /> New BnB listing
        </Link>
      </div>

      <BnbListingsClient initialListings={(listings as any[]) ?? []} />
    </div>
  );
}
