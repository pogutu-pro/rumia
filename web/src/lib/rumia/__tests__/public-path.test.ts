import { isPublicPath } from '../public-path';

describe('isPublicPath', () => {
  it('marks the rebuilt public routes as public', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/hostels/nyeri/kamakwa/abc')).toBe(true);
    expect(isPublicPath('/bnb/123')).toBe(true);
    expect(isPublicPath('/p/some-slug')).toBe(true);
    expect(isPublicPath('/agents/mary')).toBe(true);
    expect(isPublicPath('/agent/123')).toBe(true);
    expect(isPublicPath('/listing/123')).toBe(true);
    expect(isPublicPath('/verify')).toBe(true);
    expect(isPublicPath('/book-tour')).toBe(true);
    expect(isPublicPath('/browse')).toBe(true);
    expect(isPublicPath('/compare')).toBe(true);
    expect(isPublicPath('/auth/login')).toBe(true);
    expect(isPublicPath('/saved')).toBe(true);
  });

  it('leaves the legacy apps on the old chrome', () => {
    expect(isPublicPath('/account')).toBe(false);
    expect(isPublicPath('/account?tab=saved')).toBe(false);
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/admin/review')).toBe(false);
    expect(isPublicPath('/manager')).toBe(false);
    expect(isPublicPath('/policy')).toBe(false);
    expect(isPublicPath('/terms')).toBe(false);
    expect(isPublicPath('/offline')).toBe(false);
    expect(isPublicPath('/videos')).toBe(false);
  });
});