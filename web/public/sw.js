/*!
 * Rumia Service Worker
 *
 * Deliberately small and dependency-free — no bundler output, so there is no
 * minified runtime that can throw. Registered manually (with try/catch and
 * retries) from ServiceWorkerRegister.tsx.
 *
 * Design principles:
 *  1. Auth, account, dashboard, admin, saved and API traffic is NEVER touched
 *     by this worker — not even full-page navigations. The browser talks to the
 *     server directly, so a slow OAuth callback or a form submit can never be
 *     aborted or replaced by an "offline" page.
 *  2. Public page navigations are network-first and are never aborted. A page
 *     the user has already visited is kept (bounded) and shown only when the
 *     network actually fails, or when it is so slow (>STALE_AFTER_MS) that the
 *     saved copy is the better experience. Pages that are not safe to share
 *     (`Cache-Control: no-store` / `private`) are never stored.
 *  3. Only immutable, content-hashed assets under /_next/static/ and a few
 *     public static file types are cache-first. Both caches are size-bounded.
 *  4. skipWaiting + clientsClaim: a freshly deployed SW takes over without
 *     waiting for tab close, so users are never stuck behind an old worker.
 */
(function () {
  'use strict';

  var STATIC_CACHE = 'rumia-static-v6';
  var OFFLINE_CACHE = 'rumia-offline-v6';
  var PAGES_CACHE = 'rumia-pages-v6';
  var OFFLINE_URL = '/offline';

  // When a saved copy of the page exists, prefer it if the network has not
  // answered within this long (slow/flaky mobile data). With no saved copy we
  // wait for the network for as long as the browser does.
  var STALE_AFTER_MS = 8000;
  var MAX_PAGES = 40;
  var MAX_STATIC = 300;

  var AUTH_PREFIXES = ['/auth/', '/api/auth/'];
  var NETWORK_ONLY_PREFIXES = [
    '/account',
    '/admin',
    '/dashboard',
    '/manager',
    '/saved',
    '/api/',
    '/ingest/',
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
      })
      .catch(function () {
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        });
      });
  }

  // Keep only the newest `max` entries (cache keys are returned oldest first).
  function trim(cacheName, max) {
    return caches
      .open(cacheName)
      .then(function (cache) {
        return cache.keys().then(function (keys) {
          var extra = keys.length - max;
          if (extra <= 0) return;
          return Promise.all(
            keys.slice(0, extra).map(function (key) {
              return cache.delete(key);
            }),
          );
        });
      })
      .catch(function () {});
  }

  function isCacheablePage(response) {
    if (!response || response.status !== 200 || response.type !== 'basic') return false;
    var type = response.headers.get('content-type') || '';
    if (!/text\/html/i.test(type)) return false;
    var control = response.headers.get('cache-control') || '';
    return !/no-store|private/i.test(control);
  }

  function handleNavigation(event) {
    var request = event.request;
    var key = request.url;

    return caches
      .open(PAGES_CACHE)
      .then(function (pages) {
        return pages.match(key).then(function (saved) {
          // No init argument: it would turn the navigation into a same-origin
          // fetch and an AbortSignal would let us cut off slow-but-working loads.
          var network = fetch(request).then(function (response) {
            if (isCacheablePage(response)) {
              var copy = response.clone();
              event.waitUntil(
                pages
                  .put(key, copy)
                  .then(function () {
                    return trim(PAGES_CACHE, MAX_PAGES);
                  })
                  .catch(function () {}),
              );
            }
            return response;
          });

          if (!saved) {
            return network.catch(function () {
              return offlineResponse();
            });
          }

          var settled = network.catch(function () {
            return null;
          });
          event.waitUntil(settled);
          var timer;
          var timeout = new Promise(function (resolve) {
            timer = setTimeout(function () {
              resolve(null);
            }, STALE_AFTER_MS);
          });
          return Promise.race([settled, timeout]).then(function (response) {
            clearTimeout(timer);
            return response || saved;
          });
        });
      })
      .catch(function () {
        return fetch(request).catch(function () {
          return offlineResponse();
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

  // Drop stale caches (older versions) and take control of already-open pages.
  self.addEventListener('activate', function (event) {
    event.waitUntil(
      (async function () {
        var keep = [STATIC_CACHE, OFFLINE_CACHE, PAGES_CACHE];
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

  // Cooperative update + housekeeping messages from the page.
  self.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (data.type === 'SKIP_WAITING') {
      Promise.resolve(self.skipWaiting()).catch(function () {});
    } else if (data.type === 'CLEAR_PAGE_CACHE') {
      event.waitUntil(caches.delete(PAGES_CACHE).catch(function () {}));
    }
  });

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    var url = new URL(request.url);

    // Third parties (analytics, maps, R2 images) bypass the SW entirely.
    if (url.origin !== self.location.origin) return;

    var pathname = url.pathname;

    // Auth and account/dashboard/app/API traffic must always reach the server
    // untouched — this includes full-page navigations (OAuth start/callback,
    // /account, dashboards).
    if (isOnList(pathname, AUTH_PREFIXES)) return;
    if (isOnList(pathname, NETWORK_ONLY_PREFIXES)) return;

    // Public page navigations: network-first, saved copy only as a fallback.
    // Soft (RSC) navigations and prefetches are not `navigate` requests and
    // bypass the SW.
    if (request.mode === 'navigate') {
      if (pathname === OFFLINE_URL) return;
      event.respondWith(handleNavigation(event));
      return;
    }

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
                event.waitUntil(
                  cache
                    .put(request, response.clone())
                    .then(function () {
                      return trim(STATIC_CACHE, MAX_STATIC);
                    })
                    .catch(function () {}),
                );
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
