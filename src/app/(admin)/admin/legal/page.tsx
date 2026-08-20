import { supabaseAdmin } from '@/lib/supabase/admin';
import type { LegalDocument, LegalDocumentType } from '@/types';
import { LegalDocumentsClient } from './legal-documents-client';

export const dynamic = 'force-dynamic';

type AdminLegalDocument = LegalDocument & { updater_email?: string | null };

export default async function LegalPoliciesAdminPage() {
  const { data: docs } = await supabaseAdmin
    .from('legal_documents')
    .select('*')
    .order('type', { ascending: true });

  const typedDocs = (docs ?? []) as AdminLegalDocument[];

  const updaterIds = Array.from(
    new Set(typedDocs.map((d) => d.updated_by).filter(Boolean)),
  );

  let updaterEmails: Record<string, string> = {};
  if (updaterIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('id', updaterIds);

    for (const p of profiles ?? []) {
      if (p.email) updaterEmails[p.id] = p.email;
    }
  }

  for (const doc of typedDocs) {
    doc.updater_email =
      (doc.updated_by && updaterEmails[doc.updated_by]) || null;
  }

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