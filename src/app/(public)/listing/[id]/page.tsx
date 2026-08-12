import { supabasePublic } from '@/lib/supabase/public';
import { notFound, redirect } from 'next/navigation';

// Redirect legacy UUID-based listing URLs to their canonical slug URLs.
// The middleware handles this at the edge; this is the SSR fallback.
// Immutable id → redirect target; ISR caches the tiny lookup per id.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const { data } = await supabasePublic
    .from('listings')
    .select('slug, county, area')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (data?.slug) {
    redirect(`/hostels/${data.county || 'nyeri'}/${data.area || 'dekut'}/${data.slug}`);
  }

  notFound();
}
