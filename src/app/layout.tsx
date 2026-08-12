import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import { cn } from '@/lib/utils/cn';
import { NavigationProvider } from '@/context/NavigationContext';
import { SwipeNavigator } from '@/components/pwa/SwipeNavigator';
import { BottomNav } from '@/components/pwa/BottomNav';
import { GestureTutorial } from '@/components/pwa/GestureTutorial';
import { AnimatedMain } from '@/components/pwa/AnimatedMain';
import { RouteProgress } from '@/components/pwa/RouteProgress';
import { CompareTray } from '@/components/compare/compare-tray';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { InstallBanner } from '@/components/pwa/InstallBanner';
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
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke'
  ),
  title: {
    default: 'Find Student Hostels Near DeKUT Nyeri | Rumia',
    template: '%s | Rumia',
  },
  description:
    'Discover verified student hostels near Dedan Kimathi University of Technology in Nyeri. Browse self-contained and shared rooms with direct agent contact. No fees.',
  keywords: [
    'student hostels near DeKUT',
    'student accommodation Nyeri',
    'DeKUT hostels',
    'Dedan Kimathi University hostels',
    'student housing Nyeri Kenya',
    'verified hostels near DeKUT',
  ],
  authors: [{ name: 'Rumia', url: 'https://rumia.co.ke' }],
  creator: 'Rumia',
  publisher: 'Rumia',
  icons: {
    icon: [{ url: '/images/logo/logo.svg', type: 'image/svg+xml' }],
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || 'https://www.rumia.co.ke',
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
          <NavigationProvider>
            <RouteProgress />
            <SwipeNavigator>
              <AnimatedMain>
                {children}
              </AnimatedMain>
            </SwipeNavigator>
            <CompareTray />
            <BottomNav />
            <GestureTutorial />
          </NavigationProvider>
        </Providers>
        <ServiceWorkerRegister />
        <InstallBanner />
        <Analytics />
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "2bc8ed7166524484a89c065d7cf3ba79"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
