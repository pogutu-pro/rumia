import { canonicalRedirectFor } from '../origin';

const url = new URL('https://www.rumia.co.ke/auth/google/start?next=%2Faccount');

describe('canonicalRedirectFor', () => {
  it('bounces www to the canonical apex, keeping path and query', () => {
    expect(canonicalRedirectFor('www.rumia.co.ke', url, 'https://rumia.co.ke')?.toString()).toBe(
      'https://rumia.co.ke/auth/google/start?next=%2Faccount',
    );
  });
  it('is case-insensitive and uses the first forwarded host', () => {
    expect(canonicalRedirectFor('WWW.Rumia.co.ke, proxy', url, 'https://rumia.co.ke')).not.toBeNull();
  });
  it.each(['rumia.co.ke', 'localhost:3000', '127.0.0.1:3000', 'abc123def456:3000', null])('leaves %s alone', (host) => {
    expect(canonicalRedirectFor(host, url, 'https://rumia.co.ke')).toBeNull();
  });
  it('does nothing when the canonical origin is invalid', () => {
    expect(canonicalRedirectFor('www.rumia.co.ke', url, 'not a url')).toBeNull();
  });
});
