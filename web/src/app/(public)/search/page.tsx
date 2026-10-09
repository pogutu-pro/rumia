import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SmartSearch } from './smart-search';

export const metadata: Metadata = {
  title: 'Search places',
  description: 'Say what you want in your own words: "bedsitter near DeKUT under 8k with wifi".',
  robots: { index: false },
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SmartSearch />
    </Suspense>
  );
}
