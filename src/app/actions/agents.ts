'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };

export async function updateAgentProfileAction(
  data: {
    name?: string;
    whatsapp?: string;
    profile_photo_url?: string | null;
    cover_image_url?: string | null;
    bio?: string | null;
    service_areas?: string[];
    languages?: string[];
    helping_since?: number | null;
    instagram?: string | null;
    linkedin?: string | null;
    instagram_public?: boolean;
    linkedin_public?: boolean;
    portfolio_url?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, slug')
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return { success: false, error: 'Agent profile not found' };
  }

  if (data.bio !== undefined && data.bio !== null && data.bio.length > 250) {
    return { success: false, error: 'Bio must be 250 characters or fewer' };
  }

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'whatsapp', 'profile_photo_url', 'cover_image_url',
    'bio', 'service_areas', 'languages', 'helping_since',
    'instagram', 'linkedin', 'instagram_public', 'linkedin_public',
    'portfolio_url',
  ] as const;

  for (const field of allowedFields) {
    if (field in data) {
      updateData[field] = data[field as keyof typeof data];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('agents')
    .update(updateData)
    .eq('id', agent.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/profile');
  revalidatePath(`/agents/${agent.slug}`);
  revalidatePath('/dashboard');

  return { success: true };
}
