import { redirect } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { managerApi } from '@/lib/api/manager';
import { ManagerHeader } from './manager-header';
import { RumiaChrome } from '@/components/shell/rumia-chrome';

export default async function ManagerLayout({
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

  const managerContext = await managerApi.context().catch(() => null);

  if (!managerContext) {
    redirect('/dashboard');
  }

  return (
    <RumiaChrome>
      <div className="min-h-screen bg-white">
        <ManagerHeader
          userName={managerContext.user_name}
          userEmail={user.email ?? ''}
          campusName={managerContext.campus_name}
          roleLabel={managerContext.role as 'manager' | 'admin'}
          isSuperAdmin={managerContext.is_super_admin}
          hasAgentRecord={managerContext.has_agent_record}
        />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
    </RumiaChrome>
  );
}
