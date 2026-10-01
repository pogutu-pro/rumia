import { cache } from 'react';
import { fetchPublicApi } from '@/lib/api/config';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { LegalDocumentType, PublicLegalDocument } from '@/types';

/**
 * Published legal document for a public page (Terms or Privacy Policy).
 *
 * Fetched server-side from the FastAPI public endpoint. Only published documents are served,
 * and the content is sanitized on
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
    // Only published documents are served by the endpoint (never drafts).
    const path = type === 'terms' ? '/legal/terms' : '/legal/privacy';
    const data = await fetchPublicApi<{
      id: string;
      content: string;
      status: string;
      effective_date?: string | null;
      updated_at: string;
    }>(path).catch((e: Error & { status?: number }) => {
      if (e.status === 404) return null;
      throw e;
    });

    if (!data || data.status !== 'published') return null;

    return {
      id: data.id,
      content: sanitizeHtml(data.content),
      status: data.status,
      effective_date: data.effective_date ?? null,
      updated_at: data.updated_at,
    } as PublicLegalDocument;
  },
);