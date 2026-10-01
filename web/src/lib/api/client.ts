import { getBrowserSession } from '../supabase/client';
import { getApiUrl } from './config';

/**
 * Pull a human-readable message out of a FastAPI error body. Handles the three shapes the
 * backend produces: `{detail: {code, message}}` (domain errors), `{error: {message}}`
 * (envelope) and `{detail: string | [...]}` (framework/validation errors).
 */
export function extractApiErrorMessage(body: any): string | undefined {
  if (typeof body?.detail?.message === 'string') return body.detail.message;
  if (typeof body?.error?.message === 'string') return body.error.message;
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail)) return 'Validation error';
  if (typeof body?.message === 'string') return body.message;
  return undefined;
}

export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

/**
 * Universal fetch wrapper for Client Components.
 * Automatically injects the session access token.
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = (await getBrowserSession())?.access_token;

  const headers = new Headers(options.headers || {});
  
  // Set default Content-Type if not providing FormData
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Authorization header if logged in
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let errorData: any = text;
    try {
      errorData = JSON.parse(text);
    } catch {
      // keep raw text
    }

    throw new ApiError(
      response.status,
      extractApiErrorMessage(errorData) || 'API request failed',
      errorData
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as any;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => 
    apiClient<T>(path, { ...options, method: 'GET' }),
  
  post: <T>(path: string, data?: any, options?: RequestInit) => 
    apiClient<T>(path, {
      ...options,
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  put: <T>(path: string, data?: any, options?: RequestInit) => 
    apiClient<T>(path, {
      ...options,
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  patch: <T>(path: string, data?: any, options?: RequestInit) => 
    apiClient<T>(path, {
      ...options,
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  delete: <T>(path: string, options?: RequestInit) => 
    apiClient<T>(path, { ...options, method: 'DELETE' }),
};
