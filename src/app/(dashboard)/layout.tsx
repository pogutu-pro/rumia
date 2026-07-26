import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentHeader } from './agent-header';
import { isAdminUser } from '@/lib/utils/admin';

export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const isAdmin = await isAdminUser(supabase, user.id);

  const { data: agent } = await (supabase as any)
    .from('agents')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    redirect('/account');
  }

  const agentName = agent.name || user.email || '';

  return (
    <div className="min-h-screen bg-white">
      <AgentHeader
        agentName={agentName}
        userEmail={user.email ?? ''}
        isAdmin={isAdmin}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {children}
      </main>
    </div>
  );
}
