'use server';

import { revalidatePath } from 'next/cache';
import { agentsApi } from '@/lib/api/agents';
import { isValidKenyanPhone } from '@/lib/utils/phone';

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

export async function submitAgentApplicationAction(
  input: SubmitAgentApplicationInput
): Promise<AgentApplicationResult> {
  const fullName = input.full_name?.trim();
  const phone = input.phone?.trim();
  const idNumber = input.id_number?.trim();
  const hostelName = input.hostel_name?.trim();
  const relationship = input.relationship_to_hostel?.trim();
  const ownerContact = input.owner_contact?.trim() || undefined;
  const campusId = input.campus_id?.trim();

  if (!fullName) return { success: false, error: 'Full name is required.' };
  if (!phone || !isValidKenyanPhone(phone)) {
    return { success: false, error: 'A valid Kenyan phone number is required.' };
  }
  if (!idNumber) return { success: false, error: 'National ID or Passport number is required.' };
  if (!hostelName) return { success: false, error: 'Hostel / Property name is required.' };
  if (!relationship) return { success: false, error: 'Relationship to hostel is required.' };
  if (!campusId) return { success: false, error: 'Campus selection is required.' };

  try {
    const app = await agentsApi.applyServer({
      campus_id: campusId,
      full_name: fullName,
      phone,
      id_number: idNumber,
      hostel_name: hostelName,
      relationship_to_hostel: relationship,
      owner_contact: ownerContact,
    });

    revalidatePath('/account');
    return { success: true, applicationId: app.id };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || err.data?.detail || 'Failed to record application. Please try again.',
    };
  }
}

export async function getMyAgentApplicationsAction() {
  try {
    const app = await agentsApi.getMyApplicationServer();
    return app ? [app] : [];
  } catch {
    return [];
  }
}
