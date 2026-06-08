import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

// Redirect legacy UUID-based listing URLs to their canonical slug URLs.
// The middleware handles this at the edge; this is the SSR fallback.
export default async function ListingLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('slug, county, area')
    .eq('id', id)
    .single();

  if (data?.slug) {
    redirect(`/hostels/${data.county || 'nyeri'}/${data.area || 'dekut'}/${data.slug}`);
  }

  notFound();
}
