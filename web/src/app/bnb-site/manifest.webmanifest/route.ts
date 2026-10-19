import { BNB_NAME } from '@/lib/site/bnb';

/** Web app manifest on the RumiaBnB host (Rumia's lives in app/manifest.ts). */
export function GET() {
  return Response.json(
    {
      name: BNB_NAME,
      short_name: BNB_NAME,
      description: 'Short stays around Nyeri and Mt Kenya.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#FCFBF9',
      theme_color: '#ffffff',
      icons: [{ src: '/images/logo/logo-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=0, must-revalidate' } },
  );
}
