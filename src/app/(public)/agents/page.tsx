import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AgentsDirectoryClient } from './agents-directory-client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Find Student Hostel Agents Near DeKUT Nyeri',
  description: 'Browse verified hostel agents near Dedan Kimathi University. Contact trusted local agents who help students find accommodation.',
  alternates: {
    canonical: '/agents',
  },
  openGraph: {
    title: 'Hostel Agents — Rumia',
    description: 'Browse verified hostel agents near Dedan Kimathi University.',
    url: '/agents',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default async function AgentsDirectoryPage() {
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  const activeAgents = (agents || []).filter(
    (a: any) => a.status === 'active'
  );

  return <AgentsDirectoryClient agents={activeAgents} />;
}
