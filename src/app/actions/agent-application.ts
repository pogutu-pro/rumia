'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import { createAppNotification } from './notifications';

export interface SubmitAgentApplicationInput {
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact?: string;
}

export type AgentApplicationResult =
  | { success: true; applicationId: string }
  | { success: false; error: string };

/**
 * Submits a new agent application for the currently authenticated user.
 * Enforces server-side that:
 * 1. user_id is set to auth.uid() (user can only apply for themselves).
 * 2. User must be authenticated.
 * 3. Input fields (name, phone, id_number, hostel_name, relationship) are validated.
 * 4. Application is saved with status = 'pending'.
 * 5. No role changes occur at this stage.
 */
export async function submitAgentApplicationAction(
  input: SubmitAgentApplicationInput
): Promise<AgentApplicationResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'You must be signed in to submit an application.' };
  }

  // Input Validation
  const fullName = input.full_name?.trim();
  const phone = input.phone?.trim();
  const idNumber = input.id_number?.trim();
  const hostelName = input.hostel_name?.trim();
  const relationship = input.relationship_to_hostel?.trim();
  const ownerContact = input.owner_contact?.trim() || null;
  const campusId = input.campus_id?.trim();

  if (!fullName) return { success: false, error: 'Full name is required.' };
  if (!phone || !isValidKenyanPhone(phone)) {
    return { success: false, error: 'A valid Kenyan phone number is required.' };
  }
  if (!idNumber) return { success: false, error: 'National ID or Passport number is required.' };
  if (!hostelName) return { success: false, error: 'Hostel / Property name is required.' };
  if (!relationship) return { success: false, error: 'Relationship to hostel is required.' };
  if (!campusId) return { success: false, error: 'Campus selection is required.' };

  // Validate campus exists
  const { data: campus, error: campusError } = await supabase
    .from('campuses')
    .select('id')
    .eq('id', campusId)
    .maybeSingle();

  if (campusError || !campus) {
    return { success: false, error: 'Selected campus is invalid or not active.' };
  }

  // Check if user already has an active pending application for this campus
  const { data: existingApp } = await supabase
    .from('agent_applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('campus_id', campusId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingApp) {
    return {
      success: false,
      error: 'You already have a pending application for this campus.',
    };
  }

  // Check server-side reapplication cooldown (30 days after rejection)
  const COOLDOWN_DAYS = 30;
  const { data: lastRejected } = await supabase
    .from('agent_applications')
    .select('reviewed_at, created_at')
    .eq('user_id', user.id)
    .eq('campus_id', campusId)
    .eq('status', 'rejected')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRejected) {
    const rejectedTimestamp = new Date(lastRejected.reviewed_at || lastRejected.created_at).getTime();
    const nowTimestamp = Date.now();
    const diffDays = Math.floor((nowTimestamp - rejectedTimestamp) / (1000 * 60 * 60 * 24));

    if (diffDays < COOLDOWN_DAYS) {
      const remainingDays = COOLDOWN_DAYS - diffDays;
      return {
        success: false,
        error: `Your previous application for this campus was rejected. Please wait ${remainingDays} more day(s) before applying again.`,
      };
    }
  }

  // Insert application with strictly user_id = user.id and status = 'pending'
  const { data: newApp, error: insertError } = await supabase
    .from('agent_applications')
    .insert({
      user_id: user.id, // Strictly user.id - server enforced
      campus_id: campusId,
      full_name: fullName,
      phone: phone,
      id_number: idNumber,
      hostel_name: hostelName,
      relationship_to_hostel: relationship,
      owner_contact: ownerContact,
      status: 'pending', // Strictly pending
    })
    .select('id')
    .single();

  if (insertError || !newApp) {
    return {
      success: false,
      error: insertError?.message || 'Failed to record application. Please try again.',
    };
  }

  revalidatePath('/account');

  // Notify campus manager(s) or admin if unmanaged — in-app + push.
  const title = 'New agent application';
  const body = `${fullName} applied for ${hostelName}. Tap to review.`;
  const url = '/manager/applications';

  import('@/lib/push').then(({ getManagerUserIdsForCampus, sendPushToUsers }) => {
    getManagerUserIdsForCampus(campusId).then((recipientIds) => {
      if (recipientIds.length === 0) return;
      Promise.all(
        recipientIds.map(async (recipientId) => {
          await createAppNotification({
            userId: recipientId,
            title,
            body,
            url,
          });
        }),
      ).catch(() => {});
      sendPushToUsers(recipientIds, {
        title,
        body,
        url,
        tag: `new-app-${newApp.id}`,
      }).catch(() => {});
    });
  });

  return { success: true, applicationId: newApp.id };
}

/**
 * Fetches existing applications for the current authenticated user.
 */
export async function getMyAgentApplicationsAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('agent_applications')
    .select(`
      id,
      campus_id,
      full_name,
      phone,
      id_number,
      hostel_name,
      relationship_to_hostel,
      owner_contact,
      status,
      rejection_reason,
      created_at,
      reviewed_at,
      campuses (
        id,
        name,
        slug
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return data || [];
}
