import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { cn } from '@/lib/utils/cn';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
  weight: ['400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke'
  ),
  title: {
    default: 'RUMIA — Student Accommodation Marketplace',
    template: '%s | RUMIA',
  },
  description:
    'Find and contact verified student hostels near your university in Kenya. Free browse, simple click-to-WhatsApp booking.',
  keywords: [
    'student accommodation',
    'student housing Kenya',
    'university hostels',
    'hostel booking',
    'verified hostels',
  ],
  authors: [{ name: 'RUMIA Platform Team', url: 'https://rumia.co.ke' }],
  creator: 'RUMIA Platform',
  publisher: 'RUMIA Platform',
  icons: {
    icon: [
      { url: '/images/logo/logo.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, jakarta.variable)}
      data-scroll-behavior="smooth"
    >
      <body
        className={cn(
          'min-h-screen bg-slate-50 font-sans antialiased overflow-x-hidden'
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
