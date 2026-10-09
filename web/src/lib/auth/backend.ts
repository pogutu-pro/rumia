import { clientIpFrom, clientIpHeaders } from '@/lib/net/client-ip';
import { getApiUrl } from '@/lib/api/config';
import type { BackendSession } from './session';

/** Server-side calls to the FastAPI auth endpoints. Never import from client components. */
async function post<T>(path: string, body: unknown, clientIp?: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...clientIpHeaders(clientIp) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const authBackend = {
  start: (next: string | null, appRedirect: string | null, clientIp?: string) =>
    post<{ url: string; state: string }>('/auth/google/start', { next, app_redirect: appRedirect }, clientIp),
  callback: (code: string, state: string, clientIp?: string) =>
    post<BackendSession>('/auth/google/callback', { code, state }, clientIp),
  refresh: (refreshToken: string, clientIp?: string) =>
    post<BackendSession>('/auth/token', { grant_type: 'refresh_token', refresh_token: refreshToken }, clientIp),
  logout: (refreshToken: string, clientIp?: string) => post<null>('/auth/logout', { refresh_token: refreshToken }, clientIp),
};
