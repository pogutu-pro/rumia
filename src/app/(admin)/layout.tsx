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

  // Fetch display name from agents table, fall back to email
  let userName = user.email ?? '';
  const { data: agent } = await (supabase as any)
    .from('agents')
    .select('name')
    .eq('user_id', user.id)
    .single();

  if (agent?.name) {
    userName = agent.name;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar userName={userName} userEmail={user.email ?? ''} />
      <main className="flex-1 lg:ml-60 overflow-auto pt-14 lg:pt-0 p-4 lg:p-8">{children}</main>
    </div>
  );
}
