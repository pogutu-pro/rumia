'use client';

export function ServiceWorkerRegister() {
  // Registration is handled automatically by @serwist/next via withSerwist
  // in next.config.mjs. Do NOT add a manual navigator.serviceWorker.register()
  // call here — it duplicates registration and causes stale-SW bugs.
  return null;
}
