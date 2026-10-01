import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentHeader } from './agent-header';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { profilesServerApi } from '@/lib/api/profiles.server';

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

  const [profile, agent] = await Promise.all([
    profilesServerApi.getMeServer().catch(() => null),
    agentDashboardApi.getSelf().catch(() => null),
  ]);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager' || isAdmin;

  if (!agent && !isAdmin && !isManager) {
    redirect('/account');
  }

  const agentName = agent?.name || user.email || '';

  return (
    <div className="min-h-screen bg-white">
      <AgentHeader
        agentName={agentName}
        userEmail={user.email ?? ''}
        isAdmin={isAdmin}
        isManager={isManager}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {children}
      </main>
    </div>
  );
}
