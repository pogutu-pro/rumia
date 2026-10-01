import { getApiUrl } from '@/lib/api/config';
import type { BackendSession } from './session';

/** Server-side calls to the FastAPI auth endpoints. Never import from client components. */
async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const authBackend = {
  start: (next: string | null, appRedirect: string | null) =>
    post<{ url: string; state: string }>('/auth/google/start', { next, app_redirect: appRedirect }),
  callback: (code: string, state: string) => post<BackendSession>('/auth/google/callback', { code, state }),
  refresh: (refreshToken: string) =>
    post<BackendSession>('/auth/token', { grant_type: 'refresh_token', refresh_token: refreshToken }),
  logout: (refreshToken: string) => post<null>('/auth/logout', { refresh_token: refreshToken }),
};
