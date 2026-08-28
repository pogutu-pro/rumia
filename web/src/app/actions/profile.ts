'use server';

import { createClient } from '@/lib/supabase/server';

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

/**
 * Atomically persist profile-completion fields through the server so the write
 * is a single, validated update executed with the authenticated user's session.
 *
 * Unlike the previous client-side path (which silently retried without the
 * home_campus_* columns when a "column does not exist" error occurred), this
 * action never drops fields: it either writes every provided field or returns
 * a precise error for the caller to surface.
 */
export async function saveProfileCompletionAction(
  input: ProfileSaveInput,
): Promise<ProfileSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to update your profile.' };
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.full_name !== undefined) {
    if (!input.full_name.trim()) {
      return { success: false, error: 'Please enter your full name' };
    }
    updatePayload.full_name = input.full_name.trim();
  }

  if (input.phone !== undefined) {
    if (!input.phone.trim()) {
      return { success: false, error: 'Please enter your phone number' };
    }
    if (!isValidKenyanPhone(input.phone)) {
      return {
        success: false,
        error:
          'Please enter a valid Kenyan number starting with 01, 07, +2541 or +2547',
      };
    }
    updatePayload.phone = input.phone.trim();
  }

  if (input.campus_input !== undefined) {
    if (!input.campus_input.trim()) {
      return { success: false, error: 'Please enter or choose your university/campus' };
    }

    const campusName = input.campus_input.trim();
    // Resolve the campus with an exact, case-insensitive match on the name
    // (mirrors the previous client-side logic). Avoids ILIKE wildcard
    // surprises when a user types `%` or `_`.
    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, name')
      .in('status', ['active', 'coming_soon']);
    const matched = (campuses ?? []).find(
      (c) => c.name.toLowerCase() === campusName.toLowerCase(),
    );

    if (matched?.id) {
      updatePayload.home_campus_id = matched.id;
    }
    updatePayload.home_campus_name = campusName;
    updatePayload.home_campus_confirmed_at = new Date().toISOString();
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)
    .select(
      'full_name, phone, home_campus_id, home_campus_name, home_campus_confirmed_at',
    )
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    updated: {
      ...(input.full_name !== undefined
        ? { full_name: updatedProfile?.full_name ?? input.full_name }
        : {}),
      ...(input.phone !== undefined
        ? { phone: updatedProfile?.phone ?? input.phone }
        : {}),
      ...(input.campus_input !== undefined
        ? {
            home_campus_id: updatedProfile?.home_campus_id ?? null,
            home_campus_name:
              updatedProfile?.home_campus_name ?? input.campus_input?.trim(),
            home_campus_confirmed_at:
              updatedProfile?.home_campus_confirmed_at ??
              new Date().toISOString(),
          }
        : {}),
    },
  };
}