'use server';

import * as Sentry from '@sentry/nextjs';
import { profilesServerApi } from '@/lib/api/profiles.server';

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

function isValidKenyanPhone(value: string): boolean {
  const normalized = value.replace(/\D/g, '');
  const localPattern = /^(0[17]\d{8})$/;
  const internationalPattern = /^(?:254)([17]\d{8})$/;
  return localPattern.test(normalized) || internationalPattern.test(normalized);
}

export async function saveProfileCompletionAction(
  input: ProfileSaveInput,
): Promise<ProfileSaveResult> {
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
    const updatedProfile = await profilesServerApi.updateMeServer({
      ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.campus_input ? { campus_input: input.campus_input.trim() } : {}),
      home_campus_confirmed: true,
    });

    return {
      success: true,
      updated: {
        full_name: input.full_name?.trim(),
        phone: input.phone?.trim(),
        home_campus_id: updatedProfile.home_campus_id ?? null,
        home_campus_name: updatedProfile.home_campus_name ?? (input.campus_input?.trim() || null),
        home_campus_confirmed_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { event_name: 'profile_completion_failed', source: 'web-server-action' },
    });
    return { success: false, error: err.message || err.data?.detail || 'Failed to update profile.' };
  }
}
