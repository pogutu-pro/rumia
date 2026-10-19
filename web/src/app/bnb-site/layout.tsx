import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { BnbSiteHeader } from '@/components/bnb/site-header';
import { BnbSiteFooter } from '@/components/bnb/site-footer';
import { AttributionCapture } from '@/components/bnb/attribution-capture';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { BNB_NAME } from '@/lib/site/bnb';

/**
 * RumiaBnB: served on its own host (BNB_HOST) through the rewrite in proxy.ts. Nothing here inherits Rumia's chrome;
 * the root layout only provides <html>, fonts, analytics and the service worker.
 */

const bricolage = localFont({
  src: '../../fonts/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-bricolage',
  display: 'swap',
});

const description =
  'Short stays, holiday homes and serviced apartments around Nyeri and Mt Kenya. Every place is visited and filmed by our team. Ask us on WhatsApp or request your dates.';

export const metadata: Metadata = {
  metadataBase: new URL(BNB_ORIGIN),
  // `absolute`: the root layout's "| Rumia" template must not apply here.
  title: { absolute: `${BNB_NAME}: short stays around Mt Kenya`, template: `%s | ${BNB_NAME}` },
  description,
  applicationName: BNB_NAME,
  authors: [{ name: BNB_NAME, url: BNB_ORIGIN }],
  creator: BNB_NAME,
  publisher: BNB_NAME,
  // Each page sets its own canonical; this drops the Rumia one inherited from the root layout.
  alternates: {},
  icons: { icon: [{ url: '/images/bnb/mark.svg', type: 'image/svg+xml' }] },
  appleWebApp: { title: BNB_NAME, capable: true, statusBarStyle: 'default' },
  openGraph: { siteName: BNB_NAME, type: 'website', locale: 'en_KE', description },
};

export default function BnbSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} flex min-h-dvh flex-col bg-bnb-mist text-bnb-ink`}>
      <AttributionCapture />
      <BnbSiteHeader />
      <main className="flex-1">{children}</main>
      <BnbSiteFooter />
    </div>
  );
}
