import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';
import { API_BASE_URL } from './config';
import { deviceHeaders } from '@/lib/device';
import { getBrowserSession } from '../supabase/client';

/**
 * Typed client for the Rumia API, generated from the backend's OpenAPI contract
 * (`pnpm generate:api`). A changed backend shape becomes a compile error here.
 *
 * In the browser it adds the anonymous device id and, when signed in, the access token.
 */
const browserHeaders: Middleware = {
  async onRequest({ request }) {
    for (const [k, v] of Object.entries(deviceHeaders())) request.headers.set(k, v);
    if (!request.headers.has('Authorization')) {
      const token = (await getBrowserSession().catch(() => null))?.access_token;
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
};

// The generated paths already start with /api/v1, so the client's base is the origin.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const rumia = createClient<paths>({ baseUrl: API_ORIGIN });
if (typeof window !== 'undefined') rumia.use(browserHeaders);

/** For Server Components: public reads only, cache behaviour is decided by the page (ISR). */
export function rumiaServer(init?: { revalidate?: number }) {
  return createClient<paths>({
    baseUrl: API_ORIGIN,
    fetch: (input: Request) =>
      fetch(input, init?.revalidate !== undefined ? ({ next: { revalidate: init.revalidate } } as RequestInit) : undefined),
  });
}

export type PropertyRead = components['schemas']['PropertyRead'];
export type SearchResponse = components['schemas']['SearchResponse'];
export type SearchCard = components['schemas']['SearchCard'];
export type InquiryResult = components['schemas']['InquiryResult'];
export type MarketRead = components['schemas']['MarketRead'];
export type PlaceRead = components['schemas']['PlaceRead'];
export type LandmarkRead = components['schemas']['LandmarkRead'];
export type AlertRead = components['schemas']['AlertRead'];
export type ActionPreview = components['schemas']['ActionPreview'];

export class RumiaApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RumiaApiError';
  }
}

/** Unwrap an openapi-fetch result or throw an error with a readable message. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  const err = result.error as { detail?: { message?: string } | string; error?: { message?: string } } | undefined;
  const detail = err?.detail;
  const message =
    (typeof detail === 'string' ? detail : detail?.message) || err?.error?.message || `Request failed (${result.response.status})`;
  throw new RumiaApiError(result.response.status, message);
}
