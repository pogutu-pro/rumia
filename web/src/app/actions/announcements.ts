'use server';

import { revalidatePath } from 'next/cache';
import { announcementsApi } from '@/lib/api/announcements';
import type { AnnouncementType } from '@/types';

export type AnnouncementActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

interface AnnouncementInput {
  campusId: string;
  title: string;
  message: string;
  type: AnnouncementType;
  expiresAt: string;
}

export async function createAnnouncementAction(
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  try {
    await announcementsApi.createServer({
      campus_id: input.campusId,
      title: input.title.trim(),
      message: input.message.trim(),
      type: input.type,
      expires_at: new Date(input.expiresAt).toISOString(),
    });

    revalidatePath('/');
    revalidatePath('/hostels');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to create announcement.' };
  }
}

export async function updateAnnouncementAction(
  announcementId: string,
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  try {
    await announcementsApi.updateServer(announcementId, {
      campus_id: input.campusId,
      title: input.title.trim(),
      message: input.message.trim(),
      type: input.type,
      expires_at: new Date(input.expiresAt).toISOString(),
    });

    revalidatePath('/');
    revalidatePath('/hostels');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to update announcement.' };
  }
}

export async function deleteAnnouncementAction(
  announcementId: string,
): Promise<AnnouncementActionResult> {
  try {
    await announcementsApi.deleteServer(announcementId);
    revalidatePath('/');
    revalidatePath('/hostels');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to delete announcement.' };
  }
}
