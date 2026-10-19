import { bnbHosts, bnbRewritePath, isBnbHost, isBnbSitePath, normalizeHost } from '../hosts';

describe('bnbHosts', () => {
  it('is empty when unset, so RumiaBnB is off', () => {
    expect(bnbHosts(undefined)).toEqual([]);
    expect(bnbHosts('')).toEqual([]);
  });

  it('splits, trims, lowercases and drops ports', () => {
    expect(bnbHosts(' RumiaBnB.rumia.co.ke , localhost:3000 ')).toEqual(['rumiabnb.rumia.co.ke', 'localhost']);
  });
});

describe('isBnbHost', () => {
  const hosts = ['rumiabnb.rumia.co.ke', 'bnb.localhost'];

  it('matches a configured host, with or without a port', () => {
    expect(isBnbHost('rumiabnb.rumia.co.ke', hosts)).toBe(true);
    expect(isBnbHost('bnb.localhost:3000', hosts)).toBe(true);
    expect(isBnbHost('RumiaBnB.Rumia.co.ke', hosts)).toBe(true);
  });

  it('does not match Rumia or an empty host', () => {
    expect(isBnbHost('rumia.co.ke', hosts)).toBe(false);
    expect(isBnbHost('www.rumia.co.ke', hosts)).toBe(false);
    expect(isBnbHost(null, hosts)).toBe(false);
    expect(isBnbHost('', [])).toBe(false);
  });

  it('uses the first value of a forwarded list', () => {
    expect(normalizeHost('rumiabnb.rumia.co.ke, proxy.internal')).toBe('rumiabnb.rumia.co.ke');
  });
});

describe('bnbRewritePath', () => {
  it('maps public paths into the internal segment', () => {
    expect(bnbRewritePath('/')).toBe('/bnb-site');
    expect(bnbRewritePath('/stays')).toBe('/bnb-site/stays');
    expect(bnbRewritePath('/stay/regal-nyeri')).toBe('/bnb-site/stay/regal-nyeri');
    expect(bnbRewritePath('/sitemap.xml')).toBe('/bnb-site/sitemap.xml');
  });

  it('leaves shared sign-in handlers and analytics alone', () => {
    expect(bnbRewritePath('/auth/google/start')).toBeNull();
    expect(bnbRewritePath('/auth/email/verify')).toBeNull();
    expect(bnbRewritePath('/auth/refresh')).toBeNull();
    expect(bnbRewritePath('/auth/logout')).toBeNull();
    expect(bnbRewritePath('/ingest/e')).toBeNull();
  });

  it('does not double-prefix', () => {
    expect(bnbRewritePath('/bnb-site/stays')).toBe('/bnb-site/stays');
  });
});

describe('isBnbSitePath', () => {
  it('only matches the segment itself, not look-alikes', () => {
    expect(isBnbSitePath('/bnb-site')).toBe(true);
    expect(isBnbSitePath('/bnb-site/stays')).toBe(true);
    expect(isBnbSitePath('/bnb-sites')).toBe(false);
    expect(isBnbSitePath('/bnb')).toBe(false);
  });
});
