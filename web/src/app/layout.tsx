import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from './providers';
import { cn } from '@/lib/utils/cn';
import { RouteProgress } from '@/components/pwa/RouteProgress';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { ChunkErrorRecovery } from '@/components/pwa/ChunkErrorRecovery';
import '@/styles/globals.css';

// Self-hosted variable fonts (latin subset): the build never depends on fonts.googleapis.com.
const inter = localFont({
  src: '../fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const jakarta = localFont({
  src: '../fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-jakarta',
  display: 'swap',
  preload: true,
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
    default: 'Rumia: Short Stays, Hostels & Apartments',
    template: '%s | Rumia',
  },
  description:
    'Find short stays, student hostels and apartments to rent. Real prices, move-in costs and places confirmed by their owners, with direct contact on WhatsApp.',
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
      </head>
      <body
        className={cn(
          'min-h-screen bg-slate-50 font-sans antialiased overflow-x-hidden'
        )}
      >
        <Providers>
          <RouteProgress />
          {/* Rumia's bottom bar, compare tray and install banner live in the Rumia layouts (RumiaChrome). */}
          {children}
        </Providers>
        <ServiceWorkerRegister />
        <ChunkErrorRecovery />
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
