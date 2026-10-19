import type { Metadata } from 'next';
import { BnbSiteHeader } from '@/components/bnb/site-header';
import { BnbSiteFooter } from '@/components/bnb/site-footer';
import { AttributionCapture } from '@/components/bnb/attribution-capture';
import { BNB_ORIGIN } from '@/lib/site/hosts';
import { BNB_NAME } from '@/lib/site/bnb';

/**
 * RumiaBnB: served on its own host (BNB_HOST) through the rewrite in proxy.ts. It uses Rumia's fonts and palette
 * (styles/bnb.css) but none of Rumia's chrome; the root layout only provides <html>, fonts, analytics and the service
 * worker.
 */

const description =
  'Short stays, holiday homes and serviced apartments around Nyeri and Mt Kenya. See the full price for your dates, watch the video tour, and request to book.';

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
  icons: { icon: [{ url: '/images/logo/logo-icon.svg', type: 'image/svg+xml' }] },
  appleWebApp: { title: BNB_NAME, capable: true, statusBarStyle: 'default' },
  openGraph: { siteName: BNB_NAME, type: 'website', locale: 'en_KE', description },
};

export default function BnbSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bnb-mist text-bnb-ink">
      <AttributionCapture />
      <BnbSiteHeader />
      <main className="flex-1">{children}</main>
      <BnbSiteFooter />
    </div>
  );
}
