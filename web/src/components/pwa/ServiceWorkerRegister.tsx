'use client';

import { useEffect, useRef } from 'react';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000;
const RELOAD_ONCE_KEY = 'rumia:sw:updated';

/**
 * Bulletproof service worker registration.
 *
 * @serwist/next used to inject its own `window.serwist.register()` with no
 * try/catch, which made every browser rejection a Sentry unhandledrejection
 * ("TypeError: Script sw.js load failed" on iOS Safari, "Error: Rejected" on
 * Chrome). Serwist is gone; this is now the only registration path.
 *
 * Safety:
 *  - Production only, guarded by `'serviceWorker' in navigator`.
 *  - Runs after window 'load' so a mid-navigation redirect can never abort it.
 *  - Sanity-checks that /sw.js is 200 + JavaScript before registering.
 *  - Skips re-registering when a registration already exists.
 *  - Everything is try/caught; transient failures retry with backoff.
 *  - Nudges a waiting SW to activate (SKIP_WAITING) and reloads at most once
 *    per session when an updated SW takes control (fresh chunks after deploys).
 */
export function ServiceWorkerRegister() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      startedRef.current ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    startedRef.current = true;

    const reloadOnceOnUpdate = () => {
      // Only meaningful when a SW is already controlling the page (i.e. this
      // is an update, not a very first install).
      if (!navigator.serviceWorker.controller) return;
      if (sessionStorage.getItem(RELOAD_ONCE_KEY)) return;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        sessionStorage.setItem(RELOAD_ONCE_KEY, '1');
        window.location.reload();
      });
    };

    const register = async (attempt: number): Promise<void> => {
      try {
        // 1. Avoid re-registering on every page load.
        const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
        if (existing) {
          // A newer SW may already be waiting to activate; nudge it.
          if (existing.waiting) {
            existing.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          return;
        }

        // 2. Confirm /sw.js is healthy before asking the browser to run it.
        const probe = await fetch(SW_URL, { cache: 'no-store' });
        const contentType = probe.headers.get('content-type') || '';
        if (!probe.ok) {
          throw new Error(`GET ${SW_URL} returned ${probe.status}`);
        }
        if (!contentType.includes('javascript')) {
          throw new Error(`GET ${SW_URL} served as "${contentType}", expected JavaScript`);
        }

        // 3. Register once the page is stable.
        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
        });

        // 4. Update flow: when a newer SW finishes installing while this page
        //    is still controlled by the old one, ask it to activate directly.
        registration.addEventListener('updatefound', () => {
          const next = registration.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              next.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (error) {
        // attempt 1 is the initial try; allow up to MAX_RETRIES further tries.
        if (attempt <= MAX_RETRIES) {
          setTimeout(() => void register(attempt + 1), RETRY_DELAY_MS);
        } else {
          // Deliberately non-throwing: report and continue without a PWA.
          console.error('[pwa] Service worker registration failed — continuing without PWA:', error);
        }
      }
    };

    const start = () => void register(1);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    reloadOnceOnUpdate();
  }, []);

  return null;
}