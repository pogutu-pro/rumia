/*!
 * Rumia Service Worker
 *
 * Deliberately small and dependency-free — no bundler output, so there is no
 * minified runtime that can throw. Registered manually (with try/catch and
 * retries) from ServiceWorkerRegister.tsx.
 *
 * Design principles:
 *  1. Navigations are network-first with a bounded timeout (never a silent
 *     wait) and fall back to the cached /offline page only when the network
 *     genuinely fails. Soft (RSC) navigations and prefetches bypass the SW.
 *  2. Only immutable, content-hashed assets under /_next/static/ are
 *     cache-first. That is everything that makes a PWA feel instant with zero
 *     risk of serving stale app shell.
 *  3. Auth, account, dashboard, admin, saved and API traffic always hit the
 *     network.
 *  4. skipWaiting + clientsClaim: a freshly deployed SW takes over without
 *     waiting for tab close, so users are never stuck behind an old worker.
 */
(function () {
  'use strict';

  var STATIC_CACHE = 'rumia-static-v5';
  var OFFLINE_CACHE = 'rumia-offline-v5';
  var OFFLINE_URL = '/offline';
  // Hard cap so a hung request (e.g. a captive portal) surfaces the offline
  // page instead of an endless loading skeleton.
  var NAV_TIMEOUT_MS = 20000;

  var AUTH_PREFIXES = ['/auth/', '/api/auth/'];
  var NETWORK_ONLY_PREFIXES = [
    '/account',
    '/admin',
    '/dashboard',
    '/manager',
    '/saved',
    '/api/',
  ];

  // Same-origin public static files that are safe to cache (icons, fonts,
  // images, audio). Next.js hashes all files under /_next/static/.
  var STATIC_ASSET_RE = /\.(?:woff2?|ttf|otf|eot|ico|png|jpg|jpeg|webp|avif|svg|mp3|wav)$/i;

  function isOnList(pathname, prefixes) {
    for (var i = 0; i < prefixes.length; i++) {
      var prefix = prefixes[i];
      if (pathname === prefix.slice(0, -1) || pathname.indexOf(prefix) === 0) {
        return true;
      }
    }
    return false;
  }

  function fetchWithTimeout(request, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs);
    return fetch(request, { signal: controller.signal }).then(
      function (response) {
        clearTimeout(timer);
        return response;
      },
      function (error) {
        clearTimeout(timer);
        throw error;
      },
    );
  }

  function offlineResponse() {
    return caches
      .open(OFFLINE_CACHE)
      .then(function (cache) {
        return cache.match(OFFLINE_URL);
      })
      .then(function (cached) {
        if (cached) return cached;
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        });
      });
  }

  // Warm the offline page and activate immediately so a new deploy never
  // waits behind the old SW.
  self.addEventListener('install', function (event) {
    event.waitUntil(
      Promise.all([
        Promise.resolve(self.skipWaiting()).catch(function () {}),
        caches
          .open(OFFLINE_CACHE)
          .then(function (cache) {
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
          })
          .catch(function () {}),
      ]),
    );
  });

  // Drop stale caches and take control of already-open pages.
  self.addEventListener('activate', function (event) {
    event.waitUntil(
      (async function () {
        var keep = [STATIC_CACHE, OFFLINE_CACHE];
        var names = await caches.keys();
        await Promise.all(
          names
            .filter(function (name) {
              return keep.indexOf(name) === -1;
            })
            .map(function (name) {
              return caches.delete(name);
            }),
        );
        await self.clients.claim();
      })().catch(function () {}),
    );
  });

  // Cooperative update: allow the registration code to nudge a waiting SW.
  self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      Promise.resolve(self.skipWaiting()).catch(function () {});
    }
  });

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    var url = new URL(request.url);

    // Full-page navigations: network-first with a bounded timeout, falling
    // back to the cached offline page when offline.
    if (request.mode === 'navigate') {
      event.respondWith(
        fetchWithTimeout(request, NAV_TIMEOUT_MS)
          .catch(function () {
            return offlineResponse();
          })
          .catch(function () {
            return new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            });
          }),
      );
      return;
    }

    // Only same-origin assets. Third parties (Supabase, analytics, maps)
    // bypass the SW entirely.
    if (url.origin !== self.location.origin) return;

    var pathname = url.pathname;

    // Auth and account/dashboard/app/API traffic must always reach the server.
    if (isOnList(pathname, AUTH_PREFIXES)) return;
    if (isOnList(pathname, NETWORK_ONLY_PREFIXES)) return;

    // Only cache immutable, content-hashed assets.
    if (pathname.indexOf('/_next/static/') !== 0 && !STATIC_ASSET_RE.test(pathname)) {
      return;
    }

    event.respondWith(
      caches
        .open(STATIC_CACHE)
        .then(function (cache) {
          return cache.match(request).then(function (cached) {
            if (cached) return cached;
            return fetch(request).then(function (response) {
              // Never cache a wrong-typed body (e.g. an HTML error page served for a chunk URL):
              // cache-first would replay it forever and break webpack's module loading.
              var type = response.headers.get('content-type') || '';
              if (response.status === 200 && !/text\/html|text\/plain/i.test(type)) {
                cache.put(request, response.clone());
              }
              return response;
            });
          });
        })
        .catch(function () {
          return fetch(request);
        }),
    );
  });
})();