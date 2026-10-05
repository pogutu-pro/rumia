import * as Sentry from '@sentry/nextjs';
import { ApiError } from './client';
import { profilesApi } from './profiles';
import { isValidKenyanPhone } from '@/lib/utils/phone';

export interface ProfileSaveInput {
  full_name?: string;
  phone?: string;
  campus_input?: string;
}

export type ProfileSaveFailureKind = 'validation' | 'auth' | 'offline' | 'unavailable' | 'server';

export type ProfileSaveResult =
  | {
      success: true;
      updated: {
        full_name?: string;
        phone?: string;
        home_campus_id?: string | null;
        home_campus_name?: string | null;
        home_campus_confirmed_at?: string | null;
      };
    }
  | { success: false; kind: ProfileSaveFailureKind; error: string };

const RETRY_DELAYS_MS = [700, 1800];

/** Maps whatever the API layer threw to something a user can act on. */
export function classifySaveError(err: unknown): { kind: ProfileSaveFailureKind; error: string } {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'auth', error: 'Your session has expired. Please sign in again to save your details.' };
    }
    if (err.status === 400 || err.status === 422) {
      return { kind: 'validation', error: err.message || 'Please check your details and try again.' };
    }
    if (err.status === 429) {
      return { kind: 'unavailable', error: 'Too many attempts. Please wait a moment and try again.' };
    }
    if (err.status >= 502 && err.status <= 504) {
      return { kind: 'unavailable', error: 'Rumia is busy right now. Please try again in a moment.' };
    }
    return { kind: 'server', error: 'Something went wrong on our side. Please try again.' };
  }
  // fetch() rejects with a TypeError when the request never reached the server.
  if (err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { kind: 'offline', error: 'You seem to be offline. Check your connection and try again.' };
  }
  return { kind: 'server', error: 'Something went wrong. Please try again.' };
}

function isTransient(kind: ProfileSaveFailureKind): boolean {
  return kind === 'offline' || kind === 'unavailable';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Saves the post-signup profile (phone, campus, name) straight to FastAPI from the browser.
 *
 * Replaces the former `saveProfileCompletionAction` Server Action: that put an extra hop (browser →
 * Next → FastAPI) in front of an idempotent PATCH, so a deploy-skewed tab, a stale cookie or a Next
 * restart all surfaced as the same generic failure. Transient failures (offline, 502-504, 429) are
 * retried; only genuine server faults are reported to Sentry.
 */
export async function saveProfile(input: ProfileSaveInput): Promise<ProfileSaveResult> {
  if (input.phone !== undefined) {
    if (!input.phone.trim()) {
      return { success: false, kind: 'validation', error: 'Please enter your phone number' };
    }
    if (!isValidKenyanPhone(input.phone)) {
      return {
        success: false,
        kind: 'validation',
        error: 'Please enter a valid Kenyan number starting with 01, 07, +2541 or +2547',
      };
    }
  }

  const body = {
    ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
    ...(input.campus_input ? { campus_input: input.campus_input.trim() } : {}),
    home_campus_confirmed: true,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const profile = await profilesApi.updateMe(body);
      return {
        success: true,
        updated: {
          full_name: profile.full_name ?? input.full_name?.trim(),
          phone: profile.phone ?? input.phone?.trim(),
          home_campus_id: profile.home_campus_id ?? null,
          home_campus_name: profile.home_campus_name ?? (input.campus_input?.trim() || null),
          home_campus_confirmed_at: profile.home_campus_confirmed_at ?? new Date().toISOString(),
        },
      };
    } catch (err) {
      lastError = err;
      const { kind } = classifySaveError(err);
      if (!isTransient(kind) || attempt === RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  const failure = classifySaveError(lastError);
  // Only real faults are worth an alert; offline/expired-session/validation are expected user states.
  if (failure.kind === 'server') {
    Sentry.captureException(lastError instanceof Error ? lastError : new Error(String(lastError)), {
      tags: {
        event_name: 'profile_completion_failed',
        source: 'web-client',
        status: lastError instanceof ApiError ? String(lastError.status) : 'unknown',
      },
    });
  }
  return { success: false, ...failure };
}
