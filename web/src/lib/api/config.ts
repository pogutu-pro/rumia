export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

/**
 * Normalizes an API path by ensuring it starts with a slash and appending it to the base URL.
 */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Plain fetch wrapper for Server Components that read PUBLIC data only.
 * Does NOT read cookies / Supabase session, so it keeps pages static or ISR-compatible.
 * Use this for any public market data (listings feed, listing detail, search, campuses).
 * For authenticated server calls, use serverApi instead.
 */
export async function fetchPublicApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  // Do NOT set cache: 'no-store' — it forces revalidate: 0 and conflicts with
  // ISR pages that declare `export const revalidate = N`. Let the page's own
  // revalidation strategy control caching.
  const response = await fetch(getApiUrl(path), { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    let errorData: ParseData = text as any;
    try {
      errorData = JSON.parse(text);
    } catch {
      // keep raw text
    }
    const detail = errorData?.detail;
    const message =
      (typeof detail === 'string' ? detail : detail?.message) ||
      errorData?.error?.message ||
      errorData?.message ||
      `API request failed: ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null as any;
  }
  return response.json() as Promise<T>;
}

type ParseData = any;
