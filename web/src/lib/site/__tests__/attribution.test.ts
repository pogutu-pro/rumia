/** @jest-environment jsdom */
import { attributionFor, captureAttribution, utmFrom } from '../attribution';

describe('utmFrom', () => {
  it('reads and lowercases UTM parameters', () => {
    expect(utmFrom('?utm_source=TikTok&utm_campaign=Regal-Oct&x=1')).toEqual({ utm_source: 'tiktok', utm_campaign: 'regal-oct' });
  });
  it('is null without them', () => {
    expect(utmFrom('?q=nyeri')).toBeNull();
  });
});

describe('first-touch attribution', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps the first campaign even when the guest comes back directly', () => {
    captureAttribution({ search: '?utm_source=tiktok&utm_campaign=regal', pathname: '/stay/regal' }, 1000);
    captureAttribution({ search: '', pathname: '/' }, 2000);
    expect(attributionFor('Friend', 3000)).toEqual({
      utm_source: 'tiktok',
      utm_campaign: 'regal',
      landing_path: '/stay/regal',
      heard_from: 'Friend',
    });
  });

  it('a campaign replaces a plain first visit', () => {
    captureAttribution({ search: '', pathname: '/' }, 1000);
    captureAttribution({ search: '?utm_source=instagram', pathname: '/stays' }, 2000);
    expect(attributionFor(null, 3000)).toEqual({ utm_source: 'instagram', landing_path: '/stays' });
  });

  it('a second campaign does not overwrite the first', () => {
    captureAttribution({ search: '?utm_source=tiktok', pathname: '/' }, 1000);
    captureAttribution({ search: '?utm_source=youtube', pathname: '/' }, 2000);
    expect(attributionFor(null, 3000).utm_source).toBe('tiktok');
  });
});
