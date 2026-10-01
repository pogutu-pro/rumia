import { publicApi } from '@/lib/api/public';
import { notFound, redirect } from 'next/navigation';

// Redirect legacy UUID-based agent URLs to their canonical slug URLs.
// Immutable id → redirect target; ISR caches the tiny lookup per id.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ id: string }>;
}

// Redirect legacy UUID-based agent URLs to their canonical slug URLs.
export default async function AgentLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const data = await publicApi.getAgent(id, { revalidate: 86400 });

  if (data?.slug) {
    redirect(`/agents/${data.slug}`);
  }

  notFound();
}
