'use server';

import { revalidatePath } from 'next/cache';
import { getManagerUser } from './manager';
import { checkManagerCampusScope } from '@/lib/utils/manager';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AnnouncementType } from '@/types';

export type AnnouncementActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'info',
  'warning',
  'encouragement',
];

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

function isValidAnnouncementType(value: unknown): value is AnnouncementType {
  return (
    typeof value === 'string' && ANNOUNCEMENT_TYPES.includes(value as AnnouncementType)
  );
}

/**
 * Invalidates the public pages that surface announcements so manager changes
 * appear immediately instead of waiting for the 3600s ISR windows.
 */
function revalidateAnnouncementPaths() {
  revalidatePath('/');
  revalidatePath('/hostels');
  revalidatePath('/hostels/[county]/[area]', 'page');
}

interface AnnouncementInput {
  campusId: string;
  title: string;
  message: string;
  type: AnnouncementType;
  expiresAt: string;
}

function validateAnnouncementInput(input: AnnouncementInput): string | null {
  if (!input.campusId) {
    return 'Please choose a campus for this announcement.';
  }
  const title = input.title?.trim();
  if (!title) {
    return 'Please enter an announcement title.';
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  const message = input.message?.trim();
  if (!message) {
    return 'Please enter an announcement message.';
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  }
  if (!isValidAnnouncementType(input.type)) {
    return 'Invalid announcement type.';
  }
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return 'Please choose a valid expiration time.';
  }
  if (expiresAt.getTime() <= Date.now()) {
    return 'Expiration must be in the future.';
  }
  return null;
}

/**
 * Creates a new announcement for a campus the manager is scoped to.
 * Public pages only show it once `expires_at` is reached.
 */
export async function createAnnouncementAction(
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const validationError = validateAnnouncementInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { context } = manager;
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      input.campusId,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot publish announcements for a campus you do not manage',
      };
    }
  }

  const { error } = await supabaseAdmin.from('announcements').insert({
    campus_id: input.campusId,
    title: input.title.trim(),
    message: input.message.trim(),
    type: input.type,
    expires_at: new Date(input.expiresAt).toISOString(),
    created_by: manager.user.id,
  });

  if (error) {
    return { success: false, error: error.message || 'Failed to create announcement' };
  }

  revalidateAnnouncementPaths();
  return { success: true };
}

/**
 * Updates an existing announcement. Scoped to the manager's campus.
 */
export async function updateAnnouncementAction(
  announcementId: string,
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const validationError = validateAnnouncementInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('announcements')
    .select('id, campus_id')
    .eq('id', announcementId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { success: false, error: 'Announcement not found' };
  }

  const { context } = manager;
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      existing.campus_id,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot modify announcements outside your campus',
      };
    }
  }

  const { error } = await supabaseAdmin
    .from('announcements')
    .update({
      campus_id: input.campusId,
      title: input.title.trim(),
      message: input.message.trim(),
      type: input.type,
      expires_at: new Date(input.expiresAt).toISOString(),
    })
    .eq('id', announcementId);

  if (error) {
    return { success: false, error: error.message || 'Failed to update announcement' };
  }

  revalidateAnnouncementPaths();
  return { success: true };
}

/**
 * Permanently deletes an announcement. Scoped to the manager's campus.
 */
export async function deleteAnnouncementAction(
  announcementId: string,
): Promise<AnnouncementActionResult> {
  const manager = await getManagerUser();
  if (!manager) {
    return { success: false, error: 'Unauthorized: Manager role required' };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('announcements')
    .select('id, campus_id')
    .eq('id', announcementId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { success: false, error: 'Announcement not found' };
  }

  const { context } = manager;
  if (!context.isSuperAdmin) {
    const isAuthorized = await checkManagerCampusScope(
      supabaseAdmin,
      context,
      existing.campus_id,
    );
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Forbidden: You cannot delete announcements outside your campus',
      };
    }
  }

  const { error } = await supabaseAdmin.from('announcements').delete().eq('id', announcementId);

  if (error) {
    return { success: false, error: error.message || 'Failed to delete announcement' };
  }

  revalidateAnnouncementPaths();
  return { success: true };
}
