import { MOBILE_NAV, isBottomNavHidden, isNavActive } from '../nav-config';

describe('mobile bottom navigation', () => {
  it('has the five agreed destinations in order', () => {
    expect(MOBILE_NAV.map((i) => i.label)).toEqual(['Home', 'Explore', 'Videos', 'Wishlist', 'Account']);
  });

  it.each([
    ['/hostels/nyeri/near-gate-a/sunrise-hostel', true],
    ['/bnb/abc', true],
    ['/listing/abc', true],
    ['/auth/login', true],
    ['/', false],
    ['/hostels', false],
    ['/hostels/nyeri/near-gate-a', false],
    ['/bnb', false],
    ['/videos', false],
    ['/saved', false],
    ['/account', false],
    ['/dashboard/leads', false],
    ['/admin', false],
  ])('hides the bar on %s: %s', (path, hidden) => {
    expect(isBottomNavHidden(path)).toBe(hidden);
  });

  it.each([
    ['/', 'Home'],
    ['/hostels/nyeri/boma', 'Explore'],
    ['/search', 'Explore'],
    ['/videos', 'Videos'],
    ['/compare', 'Wishlist'],
    ['/account', 'Account'],
    ['/dashboard/listings', 'Account'],
    ['/manager/requests', 'Account'],
    ['/verify', 'Account'],
  ])('%s highlights %s only', (path, label) => {
    const active = MOBILE_NAV.filter((i) => isNavActive(path, i)).map((i) => i.label);
    expect(active).toEqual([label]);
  });
});
