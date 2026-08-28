import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getManagerUserContext } from '@/lib/utils/manager';
import { ManagerHeader } from './manager-header';

export default async function ManagerLayout({
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

  const managerContext = await getManagerUserContext(supabase, user.id);

  if (!managerContext) {
    redirect('/dashboard');
  }

  let campusName = 'All Campuses';
  if (managerContext.managedCampusId) {
    const { data: campus } = await supabase
      .from('campuses')
      .select('name')
      .eq('id', managerContext.managedCampusId)
      .maybeSingle();

    if (campus?.name) {
      campusName = campus.name;
    }
  } else if (!managerContext.isSuperAdmin) {
    campusName = 'Unassigned Campus';
  }

  let userName = user.email ?? '';
  let hasAgentRecord = false;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.full_name) {
    userName = profile.full_name;
  }

  const { data: agentRecord } = await (supabase as any)
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  hasAgentRecord = !!agentRecord;

  return (
    <div className="min-h-screen bg-white">
      <ManagerHeader
        userName={userName}
        userEmail={user.email ?? ''}
        campusName={campusName}
        roleLabel={managerContext.role}
        isSuperAdmin={managerContext.isSuperAdmin}
        hasAgentRecord={hasAgentRecord}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
