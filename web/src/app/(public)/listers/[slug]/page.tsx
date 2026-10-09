import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { rumiaServer } from '@/lib/api/rumia';
import { DiscoveryLanding } from '@/components/discovery/landing';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

async function load(slug: string) {
  const res = await rumiaServer({ revalidate }).GET('/api/v1/discovery/listers/{slug}', { params: { path: { slug } } }).catch(() => null);
  return res?.data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lister = await load(slug);
  return lister ? { title: lister.name, description: `Places listed by ${lister.name}.` } : { title: 'Not found' };
}

export default async function ListerPage({ params }: Props) {
  const { slug } = await params;
  const lister = await load(slug);
  if (!lister) notFound();
  const reply = lister.reply_rate != null ? ` People who contacted them said they replied ${Math.round(lister.reply_rate * 100)}% of the time.` : '';
  return <DiscoveryLanding title={lister.name} intro={`On Rumia since ${lister.since_year}.${reply}`} cards={lister.places} />;
}
