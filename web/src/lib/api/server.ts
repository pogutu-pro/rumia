import { createClient } from '../supabase/server';
import { getApiUrl, API_BASE_URL } from './config';
import { ApiError, extractApiErrorMessage } from './client';

/**
 * Universal fetch wrapper for Server Components and Server Actions.
 * Automatically injects the Supabase JWT token from cookies.
 */
export async function apiServer<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

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

  if (response.status === 204) {
    return null as any;
  }

  return response.json() as Promise<T>;
}

export const serverApi = {
  get: <T>(path: string, options?: RequestInit) => 
    apiServer<T>(path, { ...options, method: 'GET' }),
  
  post: <T>(path: string, data?: any, options?: RequestInit) => 
    apiServer<T>(path, {
      ...options,
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  put: <T>(path: string, data?: any, options?: RequestInit) => 
    apiServer<T>(path, {
      ...options,
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  patch: <T>(path: string, data?: any, options?: RequestInit) => 
    apiServer<T>(path, {
      ...options,
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    
  delete: <T>(path: string, options?: RequestInit) => 
    apiServer<T>(path, { ...options, method: 'DELETE' }),
};
