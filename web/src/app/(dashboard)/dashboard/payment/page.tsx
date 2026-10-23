import { redirect } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';
import { PaymentForm } from './payment-form';

export const revalidate = 0;

export default async function PaymentSettingsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);
  if (!agent) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <DashboardPageHeader
        title="Payment details"
        description="Your Pochi la Biashara details, so students can pay your consultation fee directly."
      />
      <PaymentForm
        initialNumber={agent.pochi_la_biashara_number ?? ''}
        initialName={agent.expected_name ?? ''}
      />
    </div>
  );
}
