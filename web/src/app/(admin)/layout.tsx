import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { AdminHeader } from './admin-header';
import { profilesServerApi } from '@/lib/api/profiles.server';

export default async function AdminLayout({
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

  if (!isAdmin) {
    redirect('/dashboard');
  }

  let userName = user.email ?? '';
  let hasAgent = false;
  if (agent?.name) {
    userName = agent.name;
    hasAgent = true;
  }

  return (
    <div className="min-h-screen bg-white">
      <AdminHeader
        userName={userName}
        userEmail={user.email ?? ''}
        isAdmin={isAdmin}
        hasAgent={hasAgent}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
