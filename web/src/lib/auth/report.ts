import * as Sentry from '@sentry/nextjs';

export type AuthStage =
  | 'start'
  | 'callback'
  | 'state_cookie'
  | 'google_error'
  | 'post_login_sync'
  | 'refresh';

export interface AuthFailure {
  stage: AuthStage;
  /** Short, stable cause such as `backend_unreachable`, `backend_429`, `state_mismatch`. Never user data. */
  cause: string;
  status?: number;
  /** Expected user-driven outcomes are not worth an alert; they stay as breadcrumbs. */
  expected?: boolean;
}

/** How a sign-in problem is shown to the user, derived from what the backend said. */
export function errorCodeForStatus(status: number | undefined): 'rate_limited' | 'server_unavailable' | 'auth_failed' {
  if (status === 429) return 'rate_limited';
  if (status === undefined || status >= 500) return 'server_unavailable';
  return 'auth_failed';
}

/**
 * Report a sign-in failure to Sentry with a cause, so a signup that fails quietly (a redirect to the
 * login page) leaves a trace. Grouped per stage + cause. Never include codes, tokens or emails.
 */
export function reportAuthFailure({ stage, cause, status, expected = false }: AuthFailure): void {
  const message = `auth ${stage} failed: ${cause}`;
  try {
    if (expected) {
      Sentry.addBreadcrumb({ category: 'auth', level: 'info', message });
      return;
    }
    Sentry.captureMessage(message, {
      level: status !== undefined && status < 500 ? 'warning' : 'error',
      tags: { auth_stage: stage, auth_cause: cause, ...(status !== undefined ? { http_status: String(status) } : {}) },
      fingerprint: ['auth', stage, cause],
    });
  } catch {
    // Reporting must never break sign-in.
  }
}
