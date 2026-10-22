'use client';

import { useEffect } from 'react';
import { isStaleBuildError, reloadIfBuildChanged } from '@/lib/pwa/chunk-recovery';

/** Recovers tabs left on an old build: failed /_next/static loads and chunk-load rejections, once a deploy is confirmed. */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const onResourceError = (event: Event) => {
      const target = event.target as (HTMLScriptElement & HTMLLinkElement) | null;
      const url = target?.src || target?.href || '';
      if (url.includes('/_next/static/')) void reloadIfBuildChanged(null, url);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleBuildError(event.reason)) void reloadIfBuildChanged(event.reason);
    };
    // Resource load errors do not bubble, so they must be caught in the capture phase.
    window.addEventListener('error', onResourceError, true);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onResourceError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
