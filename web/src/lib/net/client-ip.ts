/** Header the web tier uses to tell the API (via nginx) which visitor a server-side call is for. */
export const CLIENT_IP_HEADER = 'X-Rumia-Client-IP';

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * The visitor's address as seen by this Next.js server. nginx overwrites X-Real-IP with the verified
 * client address (from Cloudflare's CF-Connecting-IP), so it is trustworthy here. X-Forwarded-For is
 * not used: nginx also sets it, but a first value from a client could never be trusted.
 */
export function clientIpFrom(headers: HeaderReader): string | undefined {
  const real = headers.get('x-real-ip')?.trim();
  return real || undefined;
}

/** Headers to add to a server-side API call so rate limits and dedupe apply per visitor. */
export function clientIpHeaders(ip: string | undefined): Record<string, string> {
  return ip ? { [CLIENT_IP_HEADER]: ip } : {};
}
