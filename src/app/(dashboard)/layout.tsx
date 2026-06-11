import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentSidebar } from './agent-sidebar';
import { isAdminUser } from '@/lib/utils/admin';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  let agentName = agent.name || user.email || '';

  return (
    <div className="flex h-screen bg-gray-50">
      <AgentSidebar agentName={agentName} userEmail={user.email ?? ''} isAdmin={isAdmin} />
      {/* lg: offset by sidebar width; mobile: offset by top bar height */}
      <main className="flex-1 lg:ml-60 overflow-auto pt-14 lg:pt-0 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
