/**
 * Rumia Service Worker — conservative PWA architecture
 *
 * Design principles:
 *  1. Auth traffic NEVER touches the cache layer.
 *  2. Navigation requests go directly to the network.
 *  3. Only immutable, hashed static assets are cached.
 *  4. No generic API, cross-origin, or HTML caching.
 *  5. Analytics/Supabase requests bypass the SW entirely.
 *  6. A single versioned cache name makes cleanup deterministic.
 */

import {
  type PrecacheEntry,
  type SerwistGlobalConfig,
  Serwist,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ─── Cache versioning ────────────────────────────────────────────────────────
// Bump this string whenever the SW architecture changes so old caches are
// cleaned up deterministically on activate.
const STATIC_CACHE = 'rumia-static-v3';
const OFFLINE_CACHE = 'rumia-offline-v3';
const OFFLINE_URL   = '/offline';

// ─── Request classification ──────────────────────────────────────────────────

/** Auth paths that must always reach the server. */
const AUTH_PREFIXES = ['/auth/', '/api/auth/'];

/** Application paths that must always reach the server (authenticated routes). */
const NETWORK_ONLY_PREFIXES = [
  '/account',
  '/admin',
  '/dashboard',
  '/manager',
  '/saved',
  '/api/',
];

function isAuthRequest(url: URL): boolean {
  return AUTH_PREFIXES.some(
    (p) => url.pathname === p.slice(0, -1) || url.pathname.startsWith(p),
  );
}

function isNetworkOnlyPath(url: URL): boolean {
  return NETWORK_ONLY_PREFIXES.some(
    (p) => url.pathname === p.replace(/\/$/, '') || url.pathname.startsWith(p),
  );
}

function isSupabaseRequest(url: URL): boolean {
  return url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co');
}

function isAnalyticsRequest(url: URL): boolean {
  return (
    url.hostname === 'static.cloudflareinsights.com' ||
    url.hostname === 'cloudflareinsights.com' ||
    url.hostname === 'vitals.vercel-insights.com' ||
    url.hostname === 'posthog.com' ||
    url.hostname.endsWith('.posthog.com') ||
    url.hostname.endsWith('.i.posthog.com')
  );
}

/**
 * Returns true only for same-origin static assets that are safe to cache:
 * hashed JS/CSS bundles and font/image files under /_next/static/.
 * These URLs contain a content hash so they are immutable.
 */
function isCacheableStaticAsset(url: URL): boolean {
  const p = url.pathname;
  // Next.js hashed chunks and CSS
  if (p.startsWith('/_next/static/')) return true;
  // Public static files with extensions (icons, fonts, images, audio)
  if (/\.(?:woff2?|ttf|otf|eot|ico|png|jpg|jpeg|webp|avif|svg|mp3|wav)$/i.test(p)) return true;
  return false;
}

// ─── Cache cleanup ───────────────────────────────────────────────────────────

async function cleanupOldCaches(): Promise<void> {
  const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((n) => !keep.has(n))
      .map((n) => caches.delete(n)),
  );
}

// ─── Serwist (precache only) ─────────────────────────────────────────────────
// We use Serwist exclusively for precaching the SW manifest entries.
// Runtime caching is handled manually below so we have full control.

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // we handle navigation ourselves
  runtimeCaching: [],       // no runtime caching via Serwist
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupOldCaches());
});

// ─── Fetch handler ───────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET. Mutations (POST/PUT/PATCH/DELETE) go straight to network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Auth — must never be cached or intercepted.
  if (isAuthRequest(url)) return;

  // 2. Supabase — must never be cached.
  if (isSupabaseRequest(url)) return;

  // 3. Analytics — pass through silently; failures must not surface as SW errors.
  if (isAnalyticsRequest(url)) {
    event.respondWith(
      fetch(request).catch(() => new Response(null, { status: 204 })),
    );
    return;
  }

  // 4. Navigation requests — always network, fall back to offline page on failure.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(OFFLINE_CACHE);
        return (await cache.match(OFFLINE_URL)) ??
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
      }),
    );
    return;
  }

  // 5. Network-only application paths (API, account, admin, dashboard…).
  if (isNetworkOnlyPath(url)) return;

  // 6. Cross-origin requests that are not analytics/Supabase — network only.
  //    We do not cache arbitrary third-party resources.
  if (url.origin !== self.location.origin) return;

  // 7. Same-origin immutable static assets — cache-first.
  if (isCacheableStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // 8. Everything else — network only. Do not intercept.
});

// Register Serwist's install/activate handlers for precaching.
serwist.addEventListeners();

// ─── Push notifications ──────────────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const { title, body, url, icon, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/images/icons/icon-192x192.png',
      badge: '/images/icons/icon-96x96.png',
      data: { url: url || '/' },
      tag: tag || 'rumia-push',
      renotify: true,
    } as NotificationOptions),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
