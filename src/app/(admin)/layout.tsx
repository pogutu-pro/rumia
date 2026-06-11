import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';
import { AdminSidebar } from './admin-sidebar';

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

  const isAdmin = await isAdminUser(supabase, user.id);

  if (!isAdmin) {
    redirect('/dashboard');
  }

  let userName = user.email ?? '';
  let hasAgent = false;
  const { data: agent } = await (supabase as any)
    .from('agents')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (agent?.name) {
    userName = agent.name;
    hasAgent = true;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar userName={userName} userEmail={user.email ?? ''} hasAgent={hasAgent} />
      <main className="lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20 lg:pb-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
