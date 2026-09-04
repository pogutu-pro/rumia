'use server';

import { profilesApi } from '@/lib/api/profiles';

export type ProfileSaveResult =
  | {
      success: true;
      updated: {
        full_name?: string;
        phone?: string;
        home_campus_id?: string | null;
        home_campus_name?: string | null;
        home_campus_confirmed_at?: string;
      };
    }
  | { success: false; error: string };

interface ProfileSaveInput {
  full_name?: string;
  phone?: string;
  campus_input?: string;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidKenyanPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  const localPattern = /^(0[17]\d{8})$/;
  const internationalPattern = /^(?:254)([17]\d{8})$/;
  return localPattern.test(normalized) || internationalPattern.test(normalized);
}

export async function saveProfileCompletionAction(
  input: ProfileSaveInput,
): Promise<ProfileSaveResult> {
  if (input.full_name !== undefined && !input.full_name.trim()) {
    return { success: false, error: 'Please enter your full name' };
  }

  if (input.phone !== undefined) {
    if (!input.phone.trim()) {
      return { success: false, error: 'Please enter your phone number' };
    }
    if (!isValidKenyanPhone(input.phone)) {
      return {
        success: false,
        error: 'Please enter a valid Kenyan number starting with 01, 07, +2541 or +2547',
      };
    }
  }

  try {
    let updatedProfile;
    if (input.campus_input) {
      updatedProfile = await profilesApi.setHomeCampusServer('', input.campus_input.trim());
    } else {
      updatedProfile = await profilesApi.updateMeServer({});
    }

    return {
      success: true,
      updated: {
        full_name: input.full_name?.trim(),
        phone: input.phone?.trim(),
        home_campus_id: updatedProfile.home_campus_id ?? null,
        home_campus_name: updatedProfile.home_campus_name ?? input.campus_input?.trim(),
        home_campus_confirmed_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update profile.' };
  }
}