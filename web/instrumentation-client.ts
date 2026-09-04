import * as Sentry from '@sentry/nextjs';
import { initPostHog } from './src/lib/posthog-client';

// Initialize PostHog telemetry
initPostHog();

// Initialize Sentry error monitoring & performance tracking
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /Loading chunk \d+ failed/,
    /Load failed/,
    /NetworkError/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
