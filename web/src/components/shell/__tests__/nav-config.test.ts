import { PRIMARY_NAV, LEGAL_NAV, isNavActive } from '../nav-config';

const byLabel = (label: string) => PRIMARY_NAV.find((i) => i.label === label)!;

describe('shell navigation', () => {
  it('marks Home active only on the home page', () => {
    expect(isNavActive('/', byLabel('Home'))).toBe(true);
    expect(isNavActive('/hostels', byLabel('Home'))).toBe(false);
  });

  it('groups discovery routes under Explore', () => {
    for (const p of ['/hostels', '/hostels/nyeri/boma/x', '/bnb/1', '/search', '/areas/nyeri/boma', '/p/sunrise']) {
      expect(isNavActive(p, byLabel('Explore'))).toBe(true);
    }
    expect(isNavActive('/videos', byLabel('Explore'))).toBe(false);
  });

  it('keeps every destination unique and free of messaging or profile entries', () => {
    const hrefs = PRIMARY_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    const labels = PRIMARY_NAV.map((i) => i.label.toLowerCase());
    expect(labels).not.toContain('messages');
    expect(labels).not.toContain('profile');
  });

  it('links the real legal routes', () => {
    expect(LEGAL_NAV.map((l) => l.href)).toEqual(['/policy', '/terms']);
  });
});
