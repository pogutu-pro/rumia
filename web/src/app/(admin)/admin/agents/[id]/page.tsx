import { redirect } from 'next/navigation';
import { adminConsoleApi } from '@/lib/api/admin-console';
import { AgentDetailClient } from './agent-detail-client';

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;

  const detail = await adminConsoleApi.agentDetail(id).catch(() => null);
  if (!detail) {
    redirect('/admin/agents');
  }

  const agent = {
    ...detail.agent,
    user_id: detail.agent.user_id as string,
    role: (detail.agent.role ?? undefined) as 'student' | 'agent' | 'admin' | undefined,
  };

  return (
    <AgentDetailClient
      agent={agent}
      listings={detail.listings}
      leads={detail.leads}
      commissions={detail.commissions as any}
    />
  );
}
