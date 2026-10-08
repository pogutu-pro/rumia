import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { CardGrid } from '@/components/rumia/landing/card-grid';
import { rumiaServer } from '@/lib/api/rumia';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke';

async function load(slug: string) {
  const { data } = await rumiaServer().GET('/api/v1/discovery/listers/{slug}', {
    params: { path: { slug } },
  });
  return data ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lister = await load(slug).catch(() => null);
  if (!lister) return { title: 'Not found | Rumia' };
  return {
    title: `${lister.name} places | Rumia`,
    description: `The places listed by ${lister.name} on Rumia, with what each really costs to move in and one tap to WhatsApp.`,
    alternates: { canonical: `${SITE}/l/${lister.slug}` },
  };
}

export default async function ListerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lister = await load(slug).catch(() => null);
  if (!lister) notFound();

  const reply =
    lister.reply_rate == null
      ? null
      : lister.reply_rate >= 0.9
        ? 'Answers about every message'
        : `Answers about ${Math.round(lister.reply_rate * 10)} in 10 messages`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight text-rum-text sm:text-3xl">{lister.name}</h1>
        <p className="text-base text-rum-muted">
          Places on Rumia since {lister.since_year}
          {reply ? ` · ${reply}` : ''}
        </p>
      </header>

      <div className="mt-6">
        {lister.places.length === 0 ? (
          <div className="rounded-rum-media border border-rum-line bg-rum-raised p-6 text-center">
            <Building2 className="mx-auto h-6 w-6 text-rum-muted" aria-hidden="true" />
            <p className="mt-2 text-base font-semibold">{lister.name} has no places listed right now.</p>
            <p className="mt-1 text-sm text-rum-muted">
              Try the{' '}
              <Link href="/" className="font-medium text-rum-accent underline underline-offset-2">
                main search
              </Link>{' '}
              instead.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-rum-muted">{lister.places.length} place{lister.places.length > 1 ? 's' : ''}</p>
            <CardGrid cards={lister.places} />
          </>
        )}
      </div>
    </div>
  );
}