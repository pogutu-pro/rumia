import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentProfileClient } from './agent-profile-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function AgentProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!agent) redirect('/dashboard');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Profile & Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Present yourself professionally to students looking for hostels.
        </p>
      </div>

      <AgentProfileClient agent={agent} />
    </div>
  );
}
