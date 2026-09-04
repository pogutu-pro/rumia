import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

function sampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function initSentry() {
  if (initialized || !sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    tracesSampleRate: sampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.2),
  });

  initialized = true;
}

export function wrapWithSentry(Component: ComponentType): ComponentType {
  return sentryDsn ? Sentry.wrap(Component as ComponentType<Record<string, unknown>>) : Component;
}
