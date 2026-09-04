import { createClient } from '../supabase/client';
import { getApiUrl } from './config';

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
 * Automatically injects the Supabase JWT token.
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

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

    // FastAPI errors use {error:{code,message,details}}; Pydantic 422s use
    // {detail:[...]}. Parse the envelope first, degrade to legacy shapes.
    const envelopeMessage =
      typeof errorData?.error?.message === 'string' ? errorData.error.message : undefined;
    const detailMessage =
      typeof errorData?.detail === 'string' ? errorData.detail : undefined;
    const validationMessage = Array.isArray(errorData?.detail) ? 'Validation error' : undefined;

    throw new ApiError(
      response.status,
      envelopeMessage || detailMessage || validationMessage || errorData?.message || 'API request failed',
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
