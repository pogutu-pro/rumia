import { clientIpFrom, clientIpHeaders, CLIENT_IP_HEADER } from '../client-ip';

describe('client ip forwarding', () => {
  it('reads the verified X-Real-IP and ignores X-Forwarded-For', () => {
    const h = new Headers({ 'x-real-ip': '41.90.1.2', 'x-forwarded-for': '6.6.6.6, 41.90.1.2' });
    expect(clientIpFrom(h)).toBe('41.90.1.2');
  });

  it('returns undefined when nginx did not set it', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '6.6.6.6' }))).toBeUndefined();
  });

  it('builds the forwarding header only when there is an address', () => {
    expect(clientIpHeaders('41.90.1.2')).toEqual({ [CLIENT_IP_HEADER]: '41.90.1.2' });
    expect(clientIpHeaders(undefined)).toEqual({});
  });
});
