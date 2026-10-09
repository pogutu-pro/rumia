/** @jest-environment jsdom */
import { getDeviceId } from '../device';
import { _queued, _resetEventsForTests, referrerKind, track } from '../events';

describe('device id', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'rumia_did=; Max-Age=0; Path=/';
  });

  it('creates a valid UUID once and reuses it', () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(getDeviceId()).toBe(first);
    expect(window.localStorage.getItem('rumia_did')).toBe(first);
  });

  it('recovers the id from the cookie when storage is wiped', () => {
    const id = getDeviceId();
    window.localStorage.clear();
    expect(getDeviceId()).toBe(id);
  });

  it('replaces a malformed stored value', () => {
    window.localStorage.setItem('rumia_did', 'not-a-uuid');
    expect(getDeviceId()).not.toBe('not-a-uuid');
  });
});

describe('events', () => {
  beforeEach(() => _resetEventsForTests());

  it('queues events with an id, timestamp and the given context', () => {
    track('property_opened', { surface: 'explore', listingId: 'abc', props: { position: 2 } });
    expect(_queued()).toHaveLength(1);
    expect(_queued()[0]).toMatchObject({ name: 'property_opened', surface: 'explore', listing_id: 'abc', props: { position: 2 } });
    expect(_queued()[0].event_id).toBeTruthy();
  });

  it('buckets referrers coarsely', () => {
    expect(referrerKind('https://l.wh.whatsapp.com/x')).toBe('whatsapp');
    expect(referrerKind('https://www.google.com/')).toBe('google');
    expect(referrerKind('')).toBe('direct');
    expect(referrerKind('', 'Mozilla Instagram 300')).toBe('instagram');
    expect(referrerKind('https://example.org/page')).toBe('other');
  });
});
