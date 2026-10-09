import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  output: 'standalone',
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://eu-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  // Permanent redirects from the old public URLs to the rebuilt screens
  // (ux/03 principles-and-IA routing table). Property pages are /p/{slug};
  // places are /{market}/{place}; compare lives inside Saved.
  async redirects() {
    return [
      { source: '/browse', destination: '/', permanent: true },
      { source: '/videos', destination: '/', permanent: true },
      { source: '/compare', destination: '/saved', permanent: true },
      { source: '/bnb', destination: '/?mode=nightly', permanent: true },
      { source: '/hostels', destination: '/', permanent: true },
      { source: '/agents', destination: '/', permanent: true },
      { source: '/agent', destination: '/', permanent: true },
      { source: '/book-tour', destination: '/help', permanent: true },
      // Old property URLs keep their slug (properties.slug == listings.slug).
      { source: '/hostels/:county/:area/:slug', destination: '/p/:slug', permanent: true },
      // Old area/place pages become the new place landing pages.
      { source: '/hostels/:county/:area', destination: '/:county/:area', permanent: true },
      // Anything else under the old directories falls back to Explore.
      { source: '/hostels/:path*', destination: '/', permanent: true },
      { source: '/agents/:path*', destination: '/', permanent: true },
      { source: '/agent/:path*', destination: '/', permanent: true },
      // The old lister home and contacts list are replaced by the workspace.
      // Exact matches only — create/edit/earnings/etc. still live under /dashboard.
      { source: '/dashboard', destination: '/workspace', permanent: true },
      { source: '/dashboard/leads', destination: '/workspace', permanent: true },
    ];
  },
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image/r2-loader.ts',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'mt0.google.com',
      },
      {
        protocol: 'https',
        hostname: 'mt1.google.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-35395ff8fc144313adfa903807f2a359.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          // The SW must be revalidated on every update check, and the scope
          // header lets it control every route (including /auth/login).
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate, no-transform' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/:file(favicon.*|apple-touch-icon.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        // Cache optimized images aggressively — they have content-hash-based filenames
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/og-dekut.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },

};

// Only wrap with Sentry config if auth token is present — avoids build failures
// when Sentry is not yet configured on the server.
const sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // The org lives in Sentry's EU region; the CLI defaults to the US host and the upload
      // would fail silently (silent: true below).
      sentryUrl: process.env.SENTRY_URL || 'https://de.sentry.io',
      silent: !process.env.CI,
      sourcemaps: {
        disable: process.env.NODE_ENV !== 'production',
      },
      telemetry: false,
    })
  : nextConfig;

