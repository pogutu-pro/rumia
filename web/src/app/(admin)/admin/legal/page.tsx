import { legalApi } from '@/lib/api/legal';
import type { LegalDocument, LegalDocumentType } from '@/types';
import { LegalDocumentsClient } from './legal-documents-client';

export const dynamic = 'force-dynamic';

type AdminLegalDocument = LegalDocument & { updater_email?: string | null };

export default async function LegalPoliciesAdminPage() {
  const docs = await legalApi.getAdminDocsServer().catch(() => []);
  const typedDocs = docs as unknown as AdminLegalDocument[];

  const byType: Partial<Record<LegalDocumentType, AdminLegalDocument | null>> =
    { terms: null, privacy: null };
  for (const doc of typedDocs) {
    byType[doc.type] = doc;
  }

  return (
    <LegalDocumentsClient
      terms={byType.terms ?? null}
      privacy={byType.privacy ?? null}
    />
  );
}