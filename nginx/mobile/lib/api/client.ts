import { authClient } from '../auth/client';
import { API_BASE_URL } from './base-url';

export class ApiError extends Error {
  code: string;
  details?: any;
  status: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  // Inject the session access token (refreshed when near expiry)
  const { data: sessionData } = await authClient.getSession();
  const token = sessionData.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && sessionData.session) {
      // Try refresh once
      const { data: refreshed } = await authClient.refreshSession();
      if (refreshed.session?.access_token) {
        headers['Authorization'] = `Bearer ${refreshed.session.access_token}`;
        const retryResponse = await fetch(url, {
          ...restOptions,
          headers,
        });
        if (retryResponse.ok) {
          return (await retryResponse.json()) as T;
        }
      }
    }

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {}

      const errorDetail = errorBody.detail || errorBody.error || {};
      const message = typeof errorDetail === 'string' ? errorDetail : errorDetail.message || response.statusText || 'An unexpected error occurred';
      const code = typeof errorDetail === 'object' ? errorDetail.code || 'HTTP_ERROR' : 'HTTP_ERROR';

      throw new ApiError(message, code, response.status, errorDetail.details);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 'TIMEOUT_ERROR', 408);
    }
    throw new ApiError(error.message || 'Network request failed', 'NETWORK_ERROR', 0);
  }
}
