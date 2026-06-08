import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

// Redirect legacy UUID-based agent URLs to their canonical slug URLs.
export default async function AgentLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('agents')
    .select('slug')
    .eq('id', id)
    .single();

  if (data?.slug) {
    redirect(`/agents/${data.slug}`);
  }

  notFound();
}
