'use client';

import posthog from 'posthog-js';

declare global {
  interface Window {
    __RUMIA_POSTHOG_INITIALIZED__?: boolean;
  }
}

function warnMissingPostHogEnv(missing: string) {
  if (process.env.NODE_ENV !== 'development') return;

  console.error(
    `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
  );
}

export function initPostHog() {
  if (typeof window === 'undefined') return posthog;

  if (window.__RUMIA_POSTHOG_INITIALIZED__ || (posthog as any).__loaded) {
    window.__RUMIA_POSTHOG_INITIALIZED__ = true;
    return posthog;
  }

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    const missing = [
      !token && 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
      !host && 'NEXT_PUBLIC_POSTHOG_HOST',
    ]
      .filter(Boolean)
      .join(', ');

    warnMissingPostHogEnv(missing);
    return posthog;
  }

  posthog.init(token, {
    api_host: '/ingest',
    ui_host: host,
    defaults: '2026-05-30',
    capture_pageview: false,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
  });

  window.__RUMIA_POSTHOG_INITIALIZED__ = true;
  return posthog;
}

export { posthog };
