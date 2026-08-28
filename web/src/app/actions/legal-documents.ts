'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/utils/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { LegalDocumentType } from '@/types';

export type LegalDocumentActionResult =
  | { success: true; status: 'draft' | 'published' }
  | { success: false; error: string };

/**
 * Validates the current session and returns the user if they are an admin.
 * Reuses Rumia's existing RBAC (profiles.role = 'admin') — no separate
 * authorization mechanism is introduced.
 */
async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const isAdmin = await isAdminUser(supabase, user.id);
  if (!isAdmin) {
    return null;
  }

  return user;
}

function isValidType(value: unknown): value is LegalDocumentType {
  return value === 'terms' || value === 'privacy';
}

function normalizeEffectiveDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

/**
 * Persists an admin's edits as a draft without touching the live document.
 *
 *   * For a published document the edit goes into draft_content — the live
 *     public policy is untouched.
 *   * For a draft (never-published) document the edit replaces `content`.
 *
 * Content is HTML-sanitized server-side before it reaches the database.
 */
export async function saveLegalDraftAction(input: {
  type: LegalDocumentType;
  content: string;
  effectiveDate?: string | null;
}): Promise<LegalDocumentActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Admin role required' };
  }

  if (!isValidType(input.type)) {
    return { success: false, error: 'Invalid document type.' };
  }

  const content = sanitizeHtml(input.content);
  if (!content.trim()) {
    return { success: false, error: 'Document content cannot be empty.' };
  }

  const effectiveDate = normalizeEffectiveDate(input.effectiveDate);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('legal_documents')
    .select('id, status')
    .eq('type', input.type)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message || 'Failed to load document.' };
  }

  let resultingStatus: 'draft' | 'published' = 'draft';

  if (existing) {
    if (existing.status === 'published') {
      // Keep the live version live; save the edit separately. The live
      // effective date stays untouched — it only changes on publish.
      const { error } = await supabaseAdmin
        .from('legal_documents')
        .update({ draft_content: content, updated_by: user.id })
        .eq('id', existing.id);

      if (error) {
        return { success: false, error: error.message || 'Failed to save draft.' };
      }
      resultingStatus = 'published';
    } else {
      const payload: Record<string, unknown> = {
        content,
        draft_content: null,
        updated_by: user.id,
      };
      if (effectiveDate) payload.effective_date = effectiveDate;

      const { error } = await supabaseAdmin
        .from('legal_documents')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        return { success: false, error: error.message || 'Failed to save draft.' };
      }
      resultingStatus = 'draft';
    }
  } else {
    const { error } = await supabaseAdmin.from('legal_documents').insert({
      type: input.type,
      content,
      status: 'draft',
      effective_date: effectiveDate,
      updated_by: user.id,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to save draft.' };
    }
    resultingStatus = 'draft';
  }

  revalidatePath('/admin/legal');
  return { success: true, status: resultingStatus };
}

/**
 * Publishes the given content as the live document.
 *
 * If a published version already exists, its live `content` is replaced by the
 * admin's edits (promoting any saved draft). The client shows a confirmation
 * dialog before calling this so the live policy is not overwritten by accident.
 * Public /terms and /policy are revalidated so the change appears immediately.
 */
export async function publishLegalDocumentAction(input: {
  type: LegalDocumentType;
  content: string;
  effectiveDate?: string | null;
}): Promise<LegalDocumentActionResult> {
  const user = await getAdminUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Admin role required' };
  }

  if (!isValidType(input.type)) {
    return { success: false, error: 'Invalid document type.' };
  }

  const content = sanitizeHtml(input.content);
  if (!content.trim()) {
    return { success: false, error: 'Document content cannot be empty.' };
  }

  const effectiveDate = normalizeEffectiveDate(input.effectiveDate);
  const publishedAt = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('legal_documents')
    .select('id')
    .eq('type', input.type)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message || 'Failed to load document.' };
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from('legal_documents')
      .update({
        content,
        draft_content: null,
        status: 'published',
        published_at: publishedAt,
        effective_date: effectiveDate ?? undefined,
        updated_by: user.id,
      })
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: error.message || 'Failed to publish document.' };
    }
  } else {
    const { error } = await supabaseAdmin.from('legal_documents').insert({
      type: input.type,
      content,
      status: 'published',
      published_at: publishedAt,
      effective_date: effectiveDate,
      updated_by: user.id,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to publish document.' };
    }
  }

  revalidatePath('/terms');
  revalidatePath('/policy');
  revalidatePath('/admin/legal');
  return { success: true, status: 'published' };
}