import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { TeamSection } from '@/components/dashboard/team-section';
import { AgentProfileClient } from './agent-profile-client';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';

export default async function AgentProfilePage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <DashboardPageHeader title="Profile" description="How students see you. A complete profile earns more trust and more enquiries." />

      <AgentProfileClient agent={agent} />

      <TeamSection />
    </div>
  );
}
