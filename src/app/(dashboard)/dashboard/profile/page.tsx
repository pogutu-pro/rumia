import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentProfileForm } from './agent-profile-form';

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
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Agent Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Present yourself professionally to students looking for hostels.
        </p>
      </div>

      <AgentProfileForm agent={agent} />
    </div>
  );
}
