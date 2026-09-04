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
  const response = await fetch(getApiUrl(path), { ...options, headers, cache: options.cache || 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    let errorData: ParseData = text as any;
    try {
      errorData = JSON.parse(text);
    } catch {
      // keep raw text
    }
    throw new Error(errorData?.detail || errorData?.message || `API request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return null as any;
  }
  return response.json() as Promise<T>;
}

type ParseData = any;
