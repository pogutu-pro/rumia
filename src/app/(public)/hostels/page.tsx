import { Metadata } from 'next';
import { Suspense } from 'react';
import HostelsSearch from './hostels-search';

export const metadata: Metadata = {
  title: 'Student Hostels Near DeKUT Nyeri — Search & Filter',
  description:
    'Search verified student hostels near Dedan Kimathi University of Technology in Nyeri. Filter by price, gender, room type, and amenities in real time.',
  alternates: { canonical: 'https://rumia.co.ke/hostels' },
  openGraph: {
    title: 'Student Hostels Near DeKUT Nyeri | Rumia',
    description:
      'Search verified student hostels near DeKUT in Nyeri. Filter by price, gender, room type, and amenities instantly.',
    url: 'https://rumia.co.ke/hostels',
    siteName: 'Rumia',
    type: 'website',
  },
};

export default function HostelsPage() {
  return (
    <Suspense>
      <HostelsSearch />
    </Suspense>
  );
}
