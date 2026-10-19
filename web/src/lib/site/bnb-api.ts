import { API_BASE_URL, fetchPublicApi } from '@/lib/api/config';
import { deviceHeaders } from '@/lib/device';
import type { components } from '@/lib/api/schema';

/** RumiaBnB data: stays from the BnB API, and the guest side of the stays API (no account needed). */

export type BnbStay = components['schemas']['BnbListingRead'];
export type StayQuote = components['schemas']['QuoteRead'];
export type StayRequestCreate = components['schemas']['StayRequestCreate'];
export type StayRequestCreated = components['schemas']['StayRequestCreated'];
export type GuestStayView = components['schemas']['GuestStayView'];
export type ConciergeContact = components['schemas']['ConciergeContactResult'];
export type Attribution = components['schemas']['Attribution'];

/** Active stays, newest ordering from the API. Server-side, cookie-free (ISR-friendly). */
export async function getStays(): Promise<BnbStay[]> {
  try {
    const feed = await fetchPublicApi<{ items: BnbStay[] }>('/bnb/public?limit=200');
    return feed.items ?? [];
  } catch {
    return [];
  }
}

/** One active stay by slug (or id). Null when it is not listed. */
export async function getStay(slug: string): Promise<BnbStay | null> {
  try {
    const stay = await fetchPublicApi<BnbStay>(`/bnb/${encodeURIComponent(slug)}`);
    return stay?.is_active ? stay : null;
  } catch {
    return null;
  }
}

export class StayApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...deviceHeaders(), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const message =
      (typeof detail === 'string' && detail) ||
      (Array.isArray(detail) && detail[0]?.msg) ||
      body?.error?.message ||
      body?.message ||
      'Something went wrong. Please try again.';
    throw new StayApiError(message, res.status);
  }
  return body as T;
}

export const staysApi = {
  quote: (listing: string, checkIn: string, checkOut: string, guests: number) =>
    call<StayQuote>(
      `/stays/quote?${new URLSearchParams({ listing, check_in: checkIn, check_out: checkOut, guests: String(guests) })}`,
    ),
  request: (data: StayRequestCreate) => call<StayRequestCreated>('/stays/requests', { method: 'POST', body: JSON.stringify(data) }),
  status: (token: string) => call<GuestStayView>(`/stays/requests/${encodeURIComponent(token)}`),
  cancel: (token: string) => call<GuestStayView>(`/stays/requests/${encodeURIComponent(token)}/cancel`, { method: 'POST' }),
  report: (token: string, stayed: boolean) =>
    call<GuestStayView>(`/stays/requests/${encodeURIComponent(token)}/report`, { method: 'POST', body: JSON.stringify({ stayed }) }),
  concierge: (
    listing: string | null,
    attribution: Attribution,
    sessionId?: string,
    trip?: { check_in?: string | null; check_out?: string | null; guests?: number | null },
  ) =>
    call<ConciergeContact>('/stays/concierge', {
      method: 'POST',
      body: JSON.stringify({ listing, attribution, session_id: sessionId, ...(trip ?? {}) }),
    }),
};
