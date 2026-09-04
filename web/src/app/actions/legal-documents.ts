'use server';

import { revalidatePath } from 'next/cache';
import { legalApi } from '@/lib/api/legal';
import type { LegalDocumentType } from '@/types';

export type LegalDocumentActionResult =
  | { success: true; status: 'draft' | 'published' }
  | { success: false; error: string };

export async function saveLegalDraftAction(input: {
  type: LegalDocumentType;
  content: string;
  effectiveDate?: string | null;
}): Promise<LegalDocumentActionResult> {
  try {
    await legalApi.saveDraftServer(input.type, input.content);
    revalidatePath('/admin/legal');
    return { success: true, status: 'draft' };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to save draft.' };
  }
}

export async function publishLegalDocumentAction(input: {
  type: LegalDocumentType;
  content: string;
  effectiveDate?: string | null;
}): Promise<LegalDocumentActionResult> {
  try {
    await legalApi.publishServer(input.type);
    revalidatePath('/terms');
    revalidatePath('/policy');
    revalidatePath('/admin/legal');
    return { success: true, status: 'published' };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to publish document.' };
  }
}