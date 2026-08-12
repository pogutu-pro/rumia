import { supabasePublic } from '@/lib/supabase/public';
import { notFound, redirect } from 'next/navigation';

// Redirect legacy UUID-based agent URLs to their canonical slug URLs.
// Immutable id → redirect target; ISR caches the tiny lookup per id.
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

// Redirect legacy UUID-based agent URLs to their canonical slug URLs.
export default async function AgentLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const { data } = await supabasePublic
    .from('agents')
    .select('slug')
    .eq('id', id)
    .single();

  if (data?.slug) {
    redirect(`/agents/${data.slug}`);
  }

  notFound();
}
