import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { cn } from '@/lib/utils/cn';
import { BottomNav } from '@/components/pwa/BottomNav';
import { RouteProgress } from '@/components/pwa/RouteProgress';
import { CompareTray } from '@/components/compare/compare-tray';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { ChunkErrorRecovery } from '@/components/pwa/ChunkErrorRecovery';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { MobileMain } from '@/components/pwa/MobileMain';
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
    default: 'Rumia: Short Stays, Hostels & Apartments in Nyeri',
    template: '%s | Rumia',
  },
  description:
    'Find short stays, student hostels and apartments to rent in Nyeri. Real prices, move-in costs and places confirmed by their owners, with direct contact on WhatsApp.',
  keywords: [
    'short stays Nyeri',
    'Airbnb Nyeri',
    'apartments to rent in Nyeri',
    'bedsitters in Nyeri',
    'student hostels near DeKUT',
    'houses to rent Nyeri Kenya',
  ],
  authors: [{ name: 'Rumia', url: 'https://rumia.co.ke' }],
  creator: 'Rumia',
  publisher: 'Rumia',
  icons: {
    icon: [{ url: '/images/logo/logo.svg', type: 'image/svg+xml' }],
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || 'https://rumia.co.ke',
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
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rumia" />
        <link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png" />
        <link rel="dns-prefetch" href="https://pub-35395ff8fc144313adfa903807f2a359.r2.dev" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={cn(
          'min-h-screen bg-slate-50 font-sans antialiased overflow-x-hidden'
        )}
      >
        <Providers>
          <RouteProgress />
          <MobileMain>
            {children}
          </MobileMain>
          <CompareTray />
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </Providers>
        <ServiceWorkerRegister />
        <ChunkErrorRecovery />
        <InstallBanner />
        {/* Production only: on localhost the beacon is rejected by CORS and fills the console with errors. */}
        {process.env.NODE_ENV === 'production' && (
        <script
          id="cloudflare-analytics"
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.cfBeaconInjected && !document.querySelector('script[src*="cloudflareinsights.com"]')) {
                window.cfBeaconInjected = true;
                var s = document.createElement('script');
                s.defer = true;
                s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
                s.setAttribute('data-cf-beacon', '{"token": "2bc8ed7166524484a89c065d7cf3ba79"}');
                document.head.appendChild(s);
              }
            `,
          }}
        />
        )}
      </body>
    </html>
  );
}
