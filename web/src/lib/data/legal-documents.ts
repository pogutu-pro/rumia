import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase/public';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { LegalDocumentType, PublicLegalDocument } from '@/types';

/**
 * Published legal document for a public page (Terms or Privacy Policy).
 *
 * Fetched server-side with the service-role data client (same as
 * announcements/campuses). Only `status = 'published'` rows are selected —
 * enforced at the database level by RLS — and the content is sanitized on
 * read as defense-in-depth before being rendered on the public pages.
 *
 * Deliberately not wrapped in unstable_cache: like announcements, page-level
 * ISR bounds regeneration, `cache()` dedupes within a render, and the admin
 * save/publish actions call revalidatePath('/terms'|'/policy') so edits show
 * up immediately.
 */
export const getPublishedLegalDocument = cache(
  async (
    type: LegalDocumentType,
  ): Promise<PublicLegalDocument | null> => {
    const { data } = await supabasePublic
      .from('legal_documents')
      .select('id, content, status, effective_date, updated_at')
      .eq('type', type)
      .eq('status', 'published')
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      content: sanitizeHtml(data.content),
      status: data.status,
      effective_date: data.effective_date ?? null,
      updated_at: data.updated_at,
    } as PublicLegalDocument;
  },
);