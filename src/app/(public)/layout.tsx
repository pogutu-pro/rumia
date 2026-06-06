import { ReactNode } from 'react';
import { PublicHeader } from '@/components/layouts/public-header';
import { Footer } from '@/components/layouts/public-footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Rumia - Campus Accommodation Marketplace',
    template: '%s | Rumia',
  },
  description:
    'Find verified campus hostels and student accommodation. Rumia connects you directly with trusted property agents.',
  keywords: [
    'student accommodation',
    'campus housing',
    'hostel listing',
    'student housing Kenya',
    'campus hostels',
  ],
  authors: [{ name: 'Rumia' }],
  creator: 'Rumia',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rumia.co.ke',
    siteName: 'Rumia',
    title: 'Rumia - Campus Accommodation Marketplace',
    description:
      'Find verified campus hostels and student accommodation. Direct contact with trusted agents.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Rumia student accommodation marketplace',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

interface LayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
