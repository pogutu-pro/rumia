type Logger = Pick<Console, 'info' | 'warn' | 'error'>;

const FALLBACK_API_URL = 'http://localhost:8000/api/v1';

const getEnvValue = (key: string): string | undefined => {
  return process.env[key];
};

export const logger: Logger | undefined =
  typeof console !== 'undefined' ? console : undefined;

export function getApiUrl(): string {
  // Try specific variables first
  const url = 
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (url && url.trim()) {
    // Ensure URL doesn't end with slash for consistency
    return url.trim().replace(/\/$/, '');
  }

  // Only warn in development
  if (process.env.NODE_ENV === 'development') {
    logger?.info?.(
      '[env] Using fallback API URL. Set NEXT_PUBLIC_API_BASE_URL to override.',
    );
  }
  
  return FALLBACK_API_URL;
}

export function isValidApiUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isMockApi = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';
};


