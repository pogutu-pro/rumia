import { createClient } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { AgentShell } from './agent-shell';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { profilesServerApi } from '@/lib/api/profiles.server';
import { RumiaChrome } from '@/components/shell/rumia-chrome';

export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

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
    <RumiaChrome>
      <AgentShell agentName={agentName} userEmail={user.email ?? ''} isAdmin={isAdmin} isManager={isManager}>
        {children}
      </AgentShell>
    </RumiaChrome>
  );
}
