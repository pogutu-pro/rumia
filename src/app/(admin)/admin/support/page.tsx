import { createClient } from '@/lib/supabase/server';
import { SupportTeamClient } from './support-team-client';

export default async function SupportTeamPage() {
  const supabase = await createClient();

  const { data: agentsRaw } = await (supabase as any)
    .from('agents')
    .select(
      'id, name, profile_photo_url, bio, verified, whatsapp, phone, slug, status, is_featured, is_founder, is_support, support_rank, is_owner',
    )
    .order('support_rank')
    .order('name');

  const agents = (agentsRaw ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    profile_photo_url: a.profile_photo_url,
    bio: a.bio,
    verified: !!a.verified,
    whatsapp: a.whatsapp,
    phone: a.phone,
    slug: a.slug,
    status: a.status,
    is_featured: !!a.is_featured,
    is_founder: !!a.is_founder,
    is_support: !!a.is_support,
    support_rank: a.support_rank ?? 0,
    is_owner: !!a.is_owner,
  }));

  return <SupportTeamClient agents={agents} />;
}
