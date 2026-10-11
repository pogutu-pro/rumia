import type { Metadata } from 'next';
import { format } from 'date-fns';
import { AppShell } from '@/components/shell';
import { Footer } from '@/components/layouts/public-footer';
import { getCampusBySlug } from '@/lib/data/campuses';
import { getPublishedLegalDocument } from '@/lib/data/legal-documents';
import { LegalDocumentBody } from '@/components/policies/legal-document-body';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const campus = await getCampusBySlug('dekut');
  const shortName = campus.short_name ?? 'DeKUT';
  const city = campus.city ?? 'Nyeri';

  return {
    title: 'Terms of Service',
    description: `Rumia terms of service — rules and guidelines for using our hostel discovery platform near ${shortName}, ${city}, Kenya.`,
  };
}

function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'MMMM d, yyyy');
}

export default async function TermsOfServicePage() {
  const doc = await getPublishedLegalDocument('terms');
  const lastUpdated = formatLongDate(doc?.updated_at);

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-var(--shell-header-h))]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-ink">
              Terms of Service
            </h1>
            {doc ? (
              <p className="mt-3 text-sm text-ink-muted">
                {doc.effective_date ? (
                  <>
                    Effective Date: {formatLongDate(doc.effective_date)} &middot;{' '}
                  </>
                ) : null}
                Last Updated: {lastUpdated}
              </p>
            ) : null}
          </div>

          {doc ? (
            <LegalDocumentBody html={doc.content} />
          ) : (
            <p className="text-ink leading-relaxed">
              The Terms of Service are temporarily unavailable. Please check back shortly.
            </p>
          )}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}