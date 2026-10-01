import { SupportTeamClient } from './support-team-client';
import { adminConsoleApi } from '@/lib/api/admin-console';

export default async function SupportTeamPage() {
  const agents = await adminConsoleApi.supportAgents().catch(() => []);

  return <SupportTeamClient agents={agents} />;
}
