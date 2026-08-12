'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Agent sends a message to admin/manager when they believe their suspension issue is resolved.
 */
export async function sendSuspensionMessageAction(message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, status, campus_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent || agent.status !== 'suspended') {
    return { success: false, error: 'Only suspended agents can send this message.' };
  }

  const trimmed = message.trim();
  if (!trimmed) return { success: false, error: 'Message cannot be empty.' };

  // Insert into agent_messages table (admin/manager reads from there)
  const { error } = await supabaseAdmin.from('agent_messages').insert({
    agent_id: agent.id,
    sender_user_id: user.id,
    message: trimmed,
    type: 'suspension_appeal',
  });

  if (error) return { success: false, error: error.message };

  // Push-notify admins and campus managers
  const { sendPushToUsers, getAdminUserIds, getManagerUserIdsForCampus } = await import('@/lib/push');
  const notifyPromises: Promise<void>[] = [];

  const adminIds = await getAdminUserIds();
  if (adminIds.length > 0) {
    notifyPromises.push(
      sendPushToUsers(adminIds, {
        title: 'Suspension Appeal',
        body: `${agent.name} says their issue is resolved and requests reinstatement.`,
        url: `/admin/agents/${agent.id}`,
        tag: `appeal-${agent.id}`,
      }).then(() => {}).catch(() => {}),
    );
  }

  if (agent.campus_id) {
    const managerIds = await getManagerUserIdsForCampus(agent.campus_id);
    if (managerIds.length > 0) {
      notifyPromises.push(
        sendPushToUsers(managerIds, {
          title: 'Suspension Appeal',
          body: `${agent.name} says their issue is resolved and requests reinstatement.`,
          url: `/manager/agents`,
          tag: `appeal-manager-${agent.id}`,
        }).then(() => {}).catch(() => {}),
      );
    }
  }

  await Promise.all(notifyPromises);

  return { success: true };
}

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
    pochi_la_biashara_number?: string | null;
    expected_name?: string | null;
    id_number?: string | null;
    hostel_name?: string | null;
    relationship_to_hostel?: string | null;
    owner_contact?: string | null;
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
    'portfolio_url', 'pochi_la_biashara_number', 'expected_name',
    'id_number', 'hostel_name', 'relationship_to_hostel', 'owner_contact',
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
