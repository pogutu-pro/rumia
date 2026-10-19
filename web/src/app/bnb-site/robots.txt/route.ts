import { BNB_ORIGIN } from '@/lib/site/hosts';

export const dynamic = 'force-dynamic';

/**
 * robots.txt on the RumiaBnB host. Crawling stays closed until launch: set BNB_INDEXABLE=true (runtime) on go-live,
 * so test listings and half-built pages never reach search results.
 */
export function GET() {
  const open = process.env.BNB_INDEXABLE === 'true';
  const body = open
    ? `User-agent: *\nAllow: /\nDisallow: /host\nDisallow: /r/\n\nSitemap: ${BNB_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
