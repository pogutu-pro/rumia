import type { Metadata } from 'next';
import { SavedScreen } from '@/components/rumia/saved/saved-screen';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Saved',
  description: 'Your saved places on this phone, a quick compare, and alerts for new matches.',
};

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <SavedScreen initialTab={tab === 'alerts' ? 'alerts' : 'places'} />;
}