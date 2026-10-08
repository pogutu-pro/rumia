import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from '@/components/rumia/site-footer';
import { getCampusBySlug } from '@/lib/data/campuses';
import { getPublishedLegalDocument } from '@/lib/data/legal-documents';
import { LegalDocumentBody } from '@/components/policies/legal-document-body';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const campus = await getCampusBySlug('dekut');
  const shortName = campus.short_name ?? 'DeKUT';
  const city = campus.city ?? 'Nyeri';

  return {
    title: 'Privacy Policy',
    description: `Rumia privacy policy — how we collect, use, and protect your personal data as a student using our hostel discovery platform near ${shortName}, ${city}.`,
  };
}

function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'MMMM d, yyyy');
}

export default async function PrivacyPolicyPage() {
  const doc = await getPublishedLegalDocument('privacy');
  const lastUpdated = formatLongDate(doc?.updated_at);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-900 transition-colors hover:text-emerald-600"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-black text-xl font-heading tracking-tight">
              RUMIA
            </span>
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-500">
            <Link
              href="/terms"
              className="transition-colors hover:text-emerald-600"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-slate-900">
              Privacy Policy
            </h1>
            {doc ? (
              <p className="mt-3 text-sm text-slate-500">
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
            <p className="text-slate-700 leading-relaxed">
              The Privacy Policy is temporarily unavailable. Please check back shortly.
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}