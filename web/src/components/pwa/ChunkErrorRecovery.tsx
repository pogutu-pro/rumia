'use client';

import { useEffect } from 'react';
import { isStaleBuildError, reloadOnceForNewBuild } from '@/lib/pwa/chunk-recovery';

/** Recovers tabs left on an old build: failed /_next/static loads and chunk-load rejections. */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const onResourceError = (event: Event) => {
      const target = event.target as (HTMLScriptElement & HTMLLinkElement) | null;
      const url = target?.src || target?.href || '';
      if (url.includes('/_next/static/')) reloadOnceForNewBuild();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleBuildError(event.reason)) reloadOnceForNewBuild();
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
