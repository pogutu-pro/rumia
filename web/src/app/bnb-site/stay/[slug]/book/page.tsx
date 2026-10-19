import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getStay } from '@/lib/site/bnb-api';
import { BookRequest } from '@/components/bnb/book-request';

export const metadata: Metadata = { title: 'Request to book', robots: { index: false, follow: false } };

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stay = await getStay(slug);
  if (!stay) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <Suspense fallback={null}>
        <BookRequest stay={stay} ident={stay.slug ?? stay.id} />
      </Suspense>
    </div>
  );
}
