'use server';

import { revalidatePath } from 'next/cache';
import { agentsApi } from '@/lib/api/agents';

type ActionResult = { success: true } | { success: false; error: string };

export async function sendSuspensionMessageAction(message: string): Promise<ActionResult> {
  const trimmed = message.trim();
  if (!trimmed) return { success: false, error: 'Message cannot be empty.' };
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
  try {
    if (data.bio !== undefined && data.bio !== null && data.bio.length > 250) {
      return { success: false, error: 'Bio must be 250 characters or fewer' };
    }

    await agentsApi.updateServer('me', {
      name: data.name,
      whatsapp: data.whatsapp,
      bio: data.bio,
      portfolio_url: data.portfolio_url,
      profile_image_url: data.profile_photo_url,
    });

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update agent profile.' };
  }
}
